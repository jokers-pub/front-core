import { AST } from "@joker.front/ast";
import { isEmptyStr, logger } from "@joker.front/shared";
import { IParser } from "./parser";
import { VNode } from "./vnode";

const LOGTAG = "Element";

export class ParserElement extends IParser<AST.Element, VNode.Element> {
    public parser() {
        this.node = new VNode.Element(this.ast.tagName, this.parent);

        this.initAttributes();

        this.initEvents();

        this.appendNode();

        this.ext.parserNodes(this.ast.childrens, this.node, this.ob);
    }

    private initAttributes() {
        for (let attr of this.ast.attributes) {
            if (attr.name === "ref") {
                if (isEmptyStr(attr.value)) {
                    logger.warn(LOGTAG, "The 'ref' value of the element cannot be empty");
                    continue;
                }

                this.ref = attr.value!;
                this.ext.addRef(attr.value!, this.node!);

                continue;
            }

            if (attr.express) {
                let change = (val: any) => {
                    if (!this.node) return;
                    this.node!.attributes[attr.name] = this.transformAttrVal(val);

                    //通知渲染更新
                    this.ext.render?.updateNode(this.node!, attr.name);

                    this.notifyNodeWatcher("update", attr.name);
                };

                let watcherVal = this.runExpressWithWatcher(
                    attr.express,
                    this.ob,
                    (newVal) => {
                        change(newVal);
                    },
                    false,
                    () => {
                        if (attr.value) {
                            return `express:${attr.value} \nfrom <${this.ast.tagName} ${attr.name}="${attr.value}" ... />  `;
                        }
                    }
                );

                this.node!.attributes[attr.name] = this.transformAttrVal(watcherVal);
            } else {
                this.node!.attributes[attr.name] = attr.value;
            }
        }
    }

    private initEvents() {
        for (let event of this.ast.events) {
            let eventCallBack = event.functionName ? this.ob[event.functionName] : undefined;

            if (event.functionName === undefined || (eventCallBack && typeof eventCallBack === "function")) {
                this.node?.events.push([
                    event.name,
                    {
                        modifiers: event.modifiers,
                        callBack: (e) => {
                            //如果空方法，不做异常处理，为事件挡板做兼容，例如：@keydown.stop
                            if (eventCallBack === undefined) {
                                return;
                            }

                            let eventParams: Array<any> = [];

                            if (event.functionParam) {
                                //事件触发时，主动获取，不需要做数据劫持监听
                                eventParams = this.runExpress(`[${event.functionParam}]`, this.ob, () => {
                                    if (event._code) {
                                        let modifiers = event.modifiers?.join(".");

                                        return `express:${event._code}\nfrom <${this.ast.tagName} @${event.name}${
                                            modifiers ? "." + modifiers : ""
                                        }="${event._code}" ... />  `;
                                    }
                                });
                            }

                            if (eventCallBack) {
                                (<Function>eventCallBack).call(this.ext.ob, e, ...eventParams);
                            }
                        }
                    }
                ]);
            } else {
                throw new Error(
                    `The callback method (${event.functionName}) specified for the ${event.name} event ` +
                        `in the ${this.ast.tagName} element was not found. Please check.`
                );
            }
        }
    }

    private transformAttrVal(val: any): any {
        if (val === undefined) {
            return false;
        }

        if (typeof val === "string") {
            return val;
        }

        if (typeof val === "boolean") {
            return val;
        }

        if (typeof val === "function") {
            return undefined;
        }

        if (Object.prototype.toString()) return val;
    }
}
