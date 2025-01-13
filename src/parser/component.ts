import { AST, EXPRESSHANDLERTAG } from "@joker.front/ast";
import { isEmptyStr, logger, noop } from "@joker.front/shared";
import { IParser } from "./parser";
import { JOKER_COMPONENT_TAG, getGlobalComponent } from "../component";
import { Component, SectionType } from "../component";
import { observer } from "../observer";

import { DEFAULT_SECTION_TAG } from "./command/section";
import { VNode } from "./vnode";

const LOGTAG = "组件解析";

export function checkIsComponent(tagName: string, ob: Component) {
    return !!ob.components[tagName] || !!getGlobalComponent(tagName);
}

export class ParserComponent extends IParser<
    (AST.Element | AST.Component) & {
        node?: VNode.Component;
    },
    VNode.Component
> {
    public parser() {
        //唤醒时
        if (this.ast.node) {
            this.node = this.ast.node;
            //重新做层级挂载
            this.node.parent = this.parent;
            //唤醒时做一次 watcher同步
            this.initPropData();
            if (this.node) {
                this.appendNode();
                this.node.component?.$mount(this.node);
            }
            return;
        }

        this.node = new VNode.Component(this.parent);

        this.initPropData();

        this.appendNode();
        this.initEvent();

        this.renderChildren();
    }

    /**
     * 是否允许重载
     * 直接指向内存的组件，无法重新实例化
     */
    public get canReload(): boolean {
        return "tagName" in this.ast || typeof this.ast.component === "function";
    }

    /** 用于重载 */
    public reload() {
        if (this.canReload) {
            //无需考虑sleep，渲染时会挂载到无根节点上
            this.beforeDestroy();
            this.renderChildren();
        } else {
            logger.warn(LOGTAG, `当前组件无法实现reload`, this.node);
        }
    }

    private initPropData() {
        for (let attr of this.ast.attributes) {
            if (attr.name === "ref") {
                if (isEmptyStr(attr.value)) {
                    logger.warn(LOGTAG, "元素的ref值不可以为空");
                    continue;
                }

                this.ref = attr.value!;
                this.ext.addRef(attr.value!, this.node!);

                continue;
            }

            if (attr.name === "keep-alive" && attr.value !== "false") {
                this.node!.keepalive = true;
            }

            if (attr.express) {
                let watcherValue = this.runExpressWithWatcher(
                    attr.express,
                    this.ob,
                    (newVal) => {
                        this.node!.propValues[attr.name] = newVal;

                        // 不做render更新，数据变更广播会向下传递
                        this.notifyNodeWatcher("update", attr.name);
                    },
                    true
                );

                this.node!.propValues[attr.name] = watcherValue;
            } else {
                this.node!.propValues[attr.name] = attr.value;
            }
        }

        this.node!.propValues = observer(this.node!.propValues);
    }

    private initEvent() {
        this.ast.events.forEach((event) => {
            let eventCallBack = event.functionName ? this.ob[event.functionName] : undefined;
            if (event.functionName === undefined) {
                this.node!.events.push([
                    event.name,
                    {
                        modifiers: event.modifiers,
                        //noop 回调，为空方法做兼容，例如：@click.stop，仅做阻止冒泡
                        callBack: noop
                    }
                ]);
            } else if (eventCallBack && typeof eventCallBack === "function") {
                this.node!.events.push([
                    event.name,
                    {
                        modifiers: event.modifiers,
                        callBack: (e) => {
                            let eventParams: Array<any> = [];

                            if (event.functionParam) {
                                //事件触发时，主动获取，不需要做数据劫持监听
                                eventParams = this.runExpress(`[${event.functionParam}]`, this.ob);
                            }

                            <Function>eventCallBack.call(this.ext.ob, e, ...eventParams);
                        }
                    }
                ]);
            } else {
                logger.error(
                    LOGTAG,
                    `${"tagName" in this.ast ? this.ast.tagName : ""}元素中${event.name}事件所指定的回调（${
                        event.functionName
                    }）方法未找到，请检查`
                );
            }
        });
    }

    private async renderChildren() {
        if ("tagName" in this.ast) {
            let component = this.ob.components[this.ast.tagName] || getGlobalComponent(this.ast.tagName);
            if (component === undefined) {
                logger.error(LOGTAG, `渲染组件失败，未找到名称为'${this.ast.tagName}'的私有组件/全局组件`);
                return;
            }

            if (!(JOKER_COMPONENT_TAG in component)) {
                component = (await component()).default;
            }

            //可能被销毁
            if (this.node) {
                let sections = this.getSections();
                this.node.name = this.ast.tagName;
                this.node.component = new component(this.node?.propValues, sections, this.node?.keepalive);
            } else {
                return;
            }
        } else if (typeof this.ast.component === "function") {
            let sections = this.getSections();

            this.node!.component = new this.ast.component(
                this.node?.propValues,
                sections,
                this.node?.keepalive
            ) as Component;
        } else {
            this.node!.component = this.ast.component as Component;
        }

        if (!this.node) return;

        //如果没有name时取初始化后的name
        if (
            !this.node.name &&
            "name" in this.node!.component &&
            this.node.component.name &&
            typeof this.node.component.name === "string"
        ) {
            this.node!.name = this.node.component.name;
        }

        this.node.component!.$mount(this.node);

        //可能会造成挂载生命周期内部卸载,可能存在内不判断
        if (!this.node) return;
        let component = this.node?.component as Component;

        if (component.isKeepAlive) {
            this.ast.node = this.node;
        }
    }

    private getSections(): Record<string, SectionType> {
        let result: Record<string, SectionType> = {};

        let resolvedAsts: AST.Node[] = [];

        //剔除条件
        this.ast.childrens.forEach((ast) => {
            if (ast.type === AST.NodeType.COMMAND && (<AST.Command>ast).cmdName === "if" && ast.childrens) {
                let ifAst = <AST.IfCommand>ast;
                let hasSection = ast.childrens.some(
                    (n) => n.type === AST.NodeType.COMMAND && (<AST.Command>n).cmdName === "section"
                );

                let validateCondition = ifAst.condition.startsWith(EXPRESSHANDLERTAG + ".$sections");
                //只要根符合$section判断，无论是否时default一律处理，不考虑劫持
                if (validateCondition) {
                    let conditionResult = this.runExpress(ifAst.condition, this.ob);

                    if (conditionResult) {
                        resolvedAsts.push(...ast.childrens);
                        return;
                    }

                    return;
                }

                if (hasSection && ifAst.kind === "if" && !validateCondition) {
                    logger.warn(
                        LOGTAG,
                        "在解析section时，发现该section包裹在一个条件语句中，该条件语句仅支持以$sections进行if判断，已作排出"
                    );

                    return;
                }
            }
            resolvedAsts.push(ast);
        });

        resolvedAsts.forEach((ast) => {
            if (ast.type === AST.NodeType.COMMAND && (<AST.Command>ast).cmdName === "section") {
                let sectionAst = <AST.SectionCommand>ast;

                let id = sectionAst.id || DEFAULT_SECTION_TAG;

                if (/^(\'|\")(.*?)((\'|\"))$/.test(id)) {
                    id = id.slice(1, -1);
                }
                //做插槽ASTS合并
                result[id] = result[id] || {
                    asts: [],
                    ob: this.ob,
                    params: sectionAst.paramKeys,
                    parser: this.ext
                };

                result[id].asts.push(...(ast.childrens || []));
            } else {
                result[DEFAULT_SECTION_TAG] = result[DEFAULT_SECTION_TAG] || {
                    asts: [],
                    ob: this.ob,
                    parser: this.ext
                };

                result[DEFAULT_SECTION_TAG].asts.push(ast);
            }
        });

        return result;
    }

    protected beforeDestroy(keepalive?: boolean) {
        if (keepalive === true && this.node?.component?.isKeepAlive) {
            this.node?.component?.$destroy();
        } else {
            this.node?.component?.$destroy(true);
            this.ast.node = undefined;
        }
    }
}
