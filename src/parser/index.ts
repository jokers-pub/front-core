import { AST } from "@joker.front/ast";
import { Component, IS_RENDER } from "../component";
import { IContainer } from "../utils/DI";
import { Render } from "./render";
import { ParserText } from "./text";
import { VNode } from "./vnode";
import { logger, remove } from "@joker.front/shared";
import { ParserComment } from "./comment";
import { ParserCondition } from "./command/condition";
import { ParserList } from "./command/for";
import { ParserCode } from "./command/code";
import { checkIsComponent, ParserComponent } from "./component";
import { ParserElement } from "./element";
import { ParserRenderSection } from "./command/section";
import { IParser } from "./parser";

export type NodeChangeType = "append" | "remove" | "update" | "after-enter" | "after-leave";

export type ObType = Component & Record<string, any>;

export class ParserTemplate {
    /** VNode 根 */
    public root: VNode.Root = new VNode.Root();

    /** VNode ref索引集 */
    public refs: Record<string, Array<VNode.Node>> = {};

    public sleeped: boolean = false;

    /**
     * node变更观察者
     */
    public nodeWatcherEvents: Record<
        string,
        Array<(node: VNode.Node, type: NodeChangeType, propertyKey?: string) => void>
    > = {};

    /** VNode 渲染处理程序 （依赖注入） */
    public render: Render.IRender;

    constructor(public asts: AST.Node[], public ob: ObType, parent?: VNode.Node) {
        this.root.component = ob;
        this.render = IContainer.get(Render.IRENDERIOCTAGID) ?? new Render.DomRender();
        if (parent && parent instanceof VNode.Node) {
            this.root.parent = parent;

            parent.childrens ??= [];
            parent.childrens.push(this.root);
        }
    }

    public async parser() {
        await this.parserNodes(this.asts, this.root);
    }

    /**
     * VNode挂载
     * @param root
     */
    public mount(root: any): void {
        //如果已经输出，则直接做挂载到render.elements
        if (this.sleeped) {
            this.weakup();
        }

        this.render?.mount(root, () => {
            this.ob[IS_RENDER].value = true;
            //向下广播
            this.root
                .find((n) => n instanceof VNode.Component && !n.component?.[IS_RENDER].value)
                .forEach((m) => {
                    m.component && (m.component[IS_RENDER].value = true);
                });
        });
    }

    public promiseQueue: Array<Promise<any>> = [];
    /**
     * 编译AST子集
     * @param asts
     * @param parent
     */
    public async parserNodes(asts: AST.Node[], parent: VNode.Node, ob?: Component & Record<string, any>) {
        if (this.asts.length === 0) return; //若被销毁责终止向下渲染
        for (let ast of asts) {
            if (this.asts.length === 0) return;

            let parseTarget: IParser<any, any> | undefined;
            if (ast.type === AST.NodeType.TEXT) {
                parseTarget = new ParserText(ast as AST.Text, ob ?? this.ob, parent, this);
            } else if (ast.type === AST.NodeType.COMMENT) {
                parseTarget = new ParserComment(ast as AST.Comment, ob ?? this.ob, parent, this);
            } else if (ast.type === AST.NodeType.COMPONENT) {
                //动态组件
                parseTarget = new ParserComponent(ast as AST.Component, ob ?? this.ob, parent, this);
            } else if (ast.type === AST.NodeType.ELEMENT) {
                let elementAST = <AST.Element>ast;
                if (checkIsComponent(elementAST.tagName, ob ?? this.ob)) {
                    parseTarget = new ParserComponent(elementAST, ob ?? this.ob, parent, this);
                } else {
                    parseTarget = new ParserElement(elementAST, ob ?? this.ob, parent, this);
                }
            } else if (ast.type === AST.NodeType.COMMAND) {
                let cmdAST = <AST.Command>ast;

                switch (cmdAST.cmdName) {
                    case "if":
                    case "elseif":
                    case "else":
                        parseTarget = new ParserCondition(cmdAST as AST.IfCommand, ob ?? this.ob, parent, this);
                        break;
                    case "for":
                        parseTarget = new ParserList(cmdAST as AST.ForCommand, ob ?? this.ob, parent, this);
                        break;
                    case "RenderSection":
                        parseTarget = new ParserRenderSection(
                            cmdAST as AST.PropertyOrFunctionCommand,
                            ob ?? this.ob,
                            parent,
                            this
                        );
                        break;
                    case "section":
                        //区域不做任何解析，直到组件加载时，去即时处理
                        break;
                    default:
                        parseTarget = new ParserCode(
                            cmdAST as AST.PropertyOrFunctionCommand,
                            ob ?? this.ob,
                            parent,
                            this
                        );
                        break;
                }
            }

            if (parseTarget) {
                let promise = parseTarget.init();
                this.promiseQueue.push(promise);
                await promise.finally(() => {
                    remove(this.promiseQueue, promise);
                    if (this.asts.length === 0 && parseTarget && parseTarget.isDestroy === false) {
                        parseTarget?.destroy();
                    }
                });
            }
        }
    }

    /**
     * 添加ref
     * @param refName ref值
     * @param node VNode节点
     */
    public addRef(refKey: string, node: VNode.Node) {
        this.refs[refKey] = this.refs[refKey] || [];

        this.refs[refKey].push(node);
    }

    /**
     * 移除Node所在ref
     * @param node VNode节点
     */
    public removeRef(node: VNode.Node) {
        for (let refKey in this.refs) {
            if (this.refs[refKey].includes(node)) {
                remove(this.refs[refKey], node);
            }
        }
    }

    /**
     * 添加节点变更观察者
     * @param ref
     * @param callBack
     */
    public addNodeWatcher(ref: string, callBack: (node: VNode.Node, type: NodeChangeType) => void) {
        this.nodeWatcherEvents[ref] = this.nodeWatcherEvents[ref] || [];

        this.nodeWatcherEvents[ref].push(callBack);
    }

    /**
     * 移除节点变更观察者
     * @param ref
     * @param callBack
     */
    public removeNodeWatcher(ref: string, callBack: Function) {
        remove(this.nodeWatcherEvents[ref] || [], callBack);
    }

    /**
     * 响应节点变更，通知观察者
     * @param ref
     * @param node
     * @param nodeChangeType
     */
    public notifyNodeWatcher(ref: string, node: VNode.Node, nodeChangeType: NodeChangeType, propertyKey?: string) {
        this.nodeWatcherEvents[ref]?.forEach((callBack) => {
            callBack(node, nodeChangeType, propertyKey);
        });
    }

    public sleep(node?: VNode.Node) {
        let parent = node || this.root;

        //应该所有节点remove，避免再次唤醒时，由于数据变更问题，造成dom树还原不一致/不更新
        parent.childrens?.forEach((m) => {
            let next = () => {
                if (m.childrens) {
                    this.sleep(m);
                }

                m.sleep = true;

                this.render?.removeNode(m, true);
            };

            if (
                this.nodeTransition(m, "leave", undefined, () => {
                    next();
                })
            ) {
                return;
            }
            next();
        });

        node === undefined && (this.sleeped = true);
    }

    private weakup(node?: VNode.Node) {
        let parent = node || this.root;

        parent.childrens?.forEach((m) => {
            m.sleep = false;
            this.render?.appendNode(m);

            if (m.childrens) {
                this.weakup(m);
            }

            this.nodeTransition(m, "enter");
        });

        node === undefined && (this.sleeped = false);
    }

    /**
     * 销毁
     */
    public destroy(keepalive?: boolean) {
        while (this.root.childrens.length) {
            let item = this.root.childrens[0];

            if (item[VNode.PARSERKEY]) {
                item[VNode.PARSERKEY].destroy(keepalive);
            } else {
                //root 类型
                remove(this.root.childrens, item);
            }
        }

        this.render.destroy();

        this.refs = {};

        this.root.childrens.length = 0;

        this.nodeWatcherEvents = {};
        this.asts.length = 0;
    }

    /** 清除所有监听，用于优化嵌套组件销毁时 自定义销毁事件再次触发watcher问题 */
    public destroyWathcers() {
        for (let node of this.root.childrens) {
            if (node[VNode.PARSERKEY]) {
                node[VNode.PARSERKEY].destroyWathcers();
            }
        }
    }

    public reSetAsts(asts: AST.Node[], keepalive?: boolean) {
        //销毁历史产物
        this.destroy(keepalive);

        this.render = IContainer.get(Render.IRENDERIOCTAGID) ?? new Render.DomRender();

        this.asts = asts;
    }

    public nodeTransition(
        node: VNode.Node | undefined,
        mode: "enter" | "leave",
        name?: string,
        callBack?: Function,
        type?: "transition" | "animation"
    ): boolean {
        if (node && node.parent?.childrens && (node instanceof VNode.Element || node instanceof VNode.Component)) {
            let nodeTransitionOption = getNodeSupportTransition(node);
            name ??= nodeTransitionOption?.name;
            type ??= nodeTransitionOption?.type;

            if (!name) return false;

            let firstElement = getFirstElement(node);

            if (firstElement) {
                mode === "enter"
                    ? this.render.elementToEnter(firstElement, name, type, () => {
                          let parser = node[VNode.PARSERKEY];

                          if (parser && parser.ref) {
                              this.notifyNodeWatcher(parser.ref, node, "after-enter");
                          }
                          callBack?.();
                      })
                    : this.render.elementToLeave(firstElement, name, type, () => {
                          let parser = node[VNode.PARSERKEY];

                          if (parser && parser.ref) {
                              this.notifyNodeWatcher(parser.ref, node, "after-leave");
                          }
                          callBack?.();
                      });

                return true;
            } else {
                logger.warn("渲染核心", "在执行node动画时，发现数据不完备，请检查");
            }
        }
        return false;
    }
}

export function getFirstElement(node: VNode.Node): VNode.Element | undefined {
    if (node instanceof VNode.Element) return node;

    if (node.childrens && node.childrens.length) {
        for (let children of node.childrens) {
            if (children instanceof VNode.Element) {
                return children;
            } else {
                return getFirstElement(children);
            }
        }
    }
    return;
}

export function getNodeSupportTransition(node: VNode.Node) {
    if (node instanceof VNode.Element || node instanceof VNode.Component) {
        let attrs: Record<string, any> = node instanceof VNode.Element ? node.attributes : node.propValues;

        return {
            name: attrs["transition-name"],
            type: attrs["transition-type"]
        };
    }
}
