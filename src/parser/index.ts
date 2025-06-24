import { AST } from "@joker.front/ast";
import { Component } from "../component";
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

export type NodeChangeType = "append" | "remove" | "update" | "after-enter" | "after-leave";

export type ObType = Component & Record<string, any>;

export class ParserTemplate {
    /** VNode root */
    public root: VNode.Root = new VNode.Root();

    /** VNode ref index set */
    public refs: Record<string, Array<VNode.Node>> = {};

    public sleeped: boolean = false;

    public promiseQueue: Set<Promise<any>> = new Set();

    /**
     * Node change observer
     */
    public nodeWatcherEvents: Record<
        string,
        Array<(node: VNode.Node, type: NodeChangeType, propertyKey?: string) => void>
    > = {};

    /** VNode rendering handler (dependency injection) */
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

    public parser() {
        this.parserNodes(this.asts, this.root);
    }

    /**
     * Mount VNode
     * @param root
     */
    public mount(root: any): void {
        // If already output, directly mount to render.elements
        if (this.sleeped) {
            this.weakup();
        }

        this.render?.mount(root);
    }

    /**
     * Compile AST subset
     * @param asts
     * @param parent
     */
    public parserNodes(asts: AST.Node[], parent: VNode.Node, ob?: Component & Record<string, any>) {
        if (this.asts.length === 0) return; // Terminate downward rendering if destroyed

        for (let ast of asts) {
            if (ast.type === AST.NodeType.TEXT) {
                new ParserText(ast as AST.Text, ob ?? this.ob, parent, this).init();
            } else if (ast.type === AST.NodeType.COMMENT) {
                new ParserComment(ast as AST.Comment, ob ?? this.ob, parent, this).init();
            } else if (ast.type === AST.NodeType.COMPONENT) {
                // Dynamic component
                new ParserComponent(ast as AST.Component, ob ?? this.ob, parent, this).init();
            } else if (ast.type === AST.NodeType.ELEMENT) {
                let elementAST = <AST.Element>ast;
                if (checkIsComponent(elementAST.tagName, ob ?? this.ob)) {
                    new ParserComponent(elementAST, ob ?? this.ob, parent, this).init();
                } else {
                    new ParserElement(elementAST, ob ?? this.ob, parent, this).init();
                }
            } else if (ast.type === AST.NodeType.COMMAND) {
                let cmdAST = <AST.Command>ast;

                switch (cmdAST.cmdName) {
                    case "if":
                    case "elseif":
                    case "else":
                        new ParserCondition(cmdAST as AST.IfCommand, ob ?? this.ob, parent, this).init();
                        break;
                    case "for":
                        new ParserList(cmdAST as AST.ForCommand, ob ?? this.ob, parent, this).init();
                        break;
                    case "RenderSection":
                        new ParserRenderSection(
                            cmdAST as AST.PropertyOrFunctionCommand,
                            ob ?? this.ob,
                            parent,
                            this
                        ).init();
                        break;
                    case "section":
                        // Sections are not parsed until component loading, handled immediately
                        break;
                    default:
                        new ParserCode(cmdAST as AST.PropertyOrFunctionCommand, ob ?? this.ob, parent, this).init();
                        break;
                }
            }
        }
    }

    /**
     * Add ref
     * @param refName ref value
     * @param node VNode node
     */
    public addRef(refKey: string, node: VNode.Node) {
        this.refs[refKey] = this.refs[refKey] || [];

        this.refs[refKey].push(node);

        node.ref = refKey;
    }

    /**
     * Remove ref where Node is located
     * @param node VNode node
     */
    public removeRef(node: VNode.Node) {
        for (let refKey in this.refs) {
            if (this.refs[refKey].includes(node)) {
                remove(this.refs[refKey], node);
            }
        }
    }

    /**
     * Add node change observer
     * @param ref
     * @param callBack
     */
    public addNodeWatcher(ref: string, callBack: (node: VNode.Node, type: NodeChangeType) => void) {
        this.nodeWatcherEvents[ref] = this.nodeWatcherEvents[ref] || [];

        this.nodeWatcherEvents[ref].push(callBack);
    }

    /**
     * Remove node change observer
     * @param ref
     * @param callBack
     */
    public removeNodeWatcher(ref: string, callBack: Function) {
        remove(this.nodeWatcherEvents[ref] || [], callBack);
    }

    /**
     * Respond to node changes and notify observers
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

        // All nodes should be removed to avoid inconsistent/delayed DOM tree restoration due to data changes when waking up again
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
     * Destroy
     */
    public destroy(keepalive?: boolean) {
        while (this.root.childrens.length) {
            let item = this.root.childrens[0];

            if (item[VNode.PARSERKEY]) {
                item[VNode.PARSERKEY].destroy(keepalive);
            } else {
                // root type
                remove(this.root.childrens, item);
            }
        }

        this.render.destroy();

        this.refs = {};

        this.root.childrens.length = 0;

        this.nodeWatcherEvents = {};
        this.asts.length = 0;
    }

    /** Clear all watches to optimize nested component destruction when custom destroy events trigger watchers again */
    public destroyWathcers() {
        for (let node of this.root.childrens) {
            if (node[VNode.PARSERKEY]) {
                node[VNode.PARSERKEY].destroyWathcers();
            }
        }
    }

    public reSetAsts(asts: AST.Node[], keepalive?: boolean) {
        // Destroy historical products
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
                logger.warn("Render Core", "Incomplete data found when executing node animation, please check");
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
