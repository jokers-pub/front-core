import { AST } from "@joker.front/ast";
import { isEmptyStr, logger } from "@joker.front/shared";
import { IParser } from "./parser";
import { VNode } from "./vnode";
import { resolveDeepPromisesInPlace } from "../utils";

const LOGTAG = "Element解析";

export class ParserElement extends IParser<AST.Element, VNode.Element> {
    public async parser() {
        this.node = new VNode.Element(this.ast.tagName, this.parent);

        let promiseQueue = this.initAttributes();

        this.initEvents();

        this.appendNode();
        if (promiseQueue.length) {
            await Promise.all(promiseQueue);
        }
        await this.ext.parserNodes(this.ast.childrens, this.node, this.ob);
    }

    private initAttributes() {
        let promiseQueue = [];
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

            if (attr.express) {
                let change = (val: any) => {
                    if (!this.node) return;
                    this.node!.attributes[attr.name] = this.transformAttrVal(val);

                    //通知渲染更新
                    this.ext.render?.updateNode(this.node!, attr.name);

                    this.notifyNodeWatcher("update", attr.name);
                };

                let watcherVal = this.runExpressWithWatcher(attr.express, this.ob, (newVal) => {
                    let transformPromiseValue = resolveDeepPromisesInPlace(newVal);
                    if (transformPromiseValue instanceof Promise) {
                        transformPromiseValue
                            .then((pv) => {
                                change(pv);
                            })
                            .catch((e) => {
                                logger.error(LOGTAG, `${attr.express}异步处理失败`, e);
                            });
                    } else {
                        change(transformPromiseValue);
                    }
                });
                let transformPromiseValue = resolveDeepPromisesInPlace(watcherVal);
                if (transformPromiseValue instanceof Promise) {
                    transformPromiseValue
                        .then((pv) => {
                            change(pv);
                        })
                        .catch((e) => {
                            logger.error(LOGTAG, `${attr.express}异步处理失败`, e);
                        });
                    promiseQueue.push(transformPromiseValue);
                } else {
                    this.node!.attributes[attr.name] = this.transformAttrVal(transformPromiseValue);
                }
            } else {
                this.node!.attributes[attr.name] = attr.value;
            }
        }

        return promiseQueue;
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
                                eventParams = this.runExpress(`[${event.functionParam}]`, this.ob);
                            }

                            if (eventCallBack) {
                                (<Function>eventCallBack).call(this.ext.ob, e, ...eventParams);
                            }
                        }
                    }
                ]);
            } else {
                throw new Error(
                    `${this.ast.tagName}元素中${event.name}事件所指定的回调（${event.functionName}）方法未找到，请检查`
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
