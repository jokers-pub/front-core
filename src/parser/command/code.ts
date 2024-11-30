import { AST, createFuntionBody } from "@joker.front/ast";
import { isEmptyStr, logger } from "@joker.front/shared";
import { GLOBAL_TAG, IParser } from "../parser";
import { VNode } from "../vnode";
import { debug } from "console";
import { resolveDeepPromisesInPlace } from "../../utils";

export class ParserCode extends IParser<AST.PropertyOrFunctionCommand, VNode.Text | VNode.Html> {
    public parser(): void {
        if (isEmptyStr(this.ast.cmdName)) {
            logger.error("模板指令", "解析AST转换VNode时发生错误，未找到指令名称", this.ast);
            throw new Error("解析AST转换VNode时发生错误，未找到指令名称");
        }

        let express: string | undefined = undefined;
        //全局过滤器
        if (this.ast.cmdName === "Html" || this.ast.cmdName === "Text") {
            express = this.ast.param;
        } else if (this.ast.cmdName.startsWith(GLOBAL_TAG + ".")) {
            express = `${this.ast.cmdName}(${this.ast.param})`;
        } else if (this.ast.cmdName in this.ob && typeof this.ob[this.ast.cmdName] === "function") {
            express = `${createFuntionBody(this.ast.cmdName)}(${this.ast.param})`;
        }

        if (express) {
            let data = this.runExpressWithWatcher(`[${express}]`, this.ob, (newVal) => {
                let transformPromiseValue = resolveDeepPromisesInPlace(newVal[0]);
                if (transformPromiseValue instanceof Promise) {
                    transformPromiseValue
                        .then((nv) => {
                            this.changeValue(nv);
                        })
                        .catch((e) => {
                            logger.error("表达式编译", `${express}异步处理失败`, e);
                        });
                } else {
                    this.changeValue(transformPromiseValue);
                }
            });

            data ||= [];
            let transformPromiseValue = resolveDeepPromisesInPlace(data[0]);
            if (transformPromiseValue instanceof Promise) {
                if (this.ast.cmdName === "Html") {
                    this.node = new VNode.Html("", this.parent, data[1]);
                } else {
                    this.node = new VNode.Text("", this.parent);
                }

                transformPromiseValue
                    .then((nv) => {
                        this.changeValue(nv);
                    })
                    .catch((e) => {
                        logger.error("表达式编译", `${express}异步处理失败`, e);
                    });
            } else {
                if (this.ast.cmdName === "Html") {
                    this.node = new VNode.Html(transformText(transformPromiseValue), this.parent, data[1]);
                } else {
                    this.node = new VNode.Text(transformText(transformPromiseValue), this.parent);
                }
            }

            this.appendNode();
            return;
        }

        throw new Error(`未找到命令：${this.ast.cmdName}`);
    }

    changeValue(val: any) {
        if (!this.node) return;
        if (this.node instanceof VNode.Html) {
            this.node.html = transformText(val);
        } else {
            this.node!.text = transformText(val);
        }

        this.ext.render?.updateNode(this.node!);
        //不需要做nodeChange广播， 因为它不具备ref能力
    }
}

function transformText(val: any): string {
    if (val === undefined || val === null || typeof val === "function") return "";

    return val.toString();
}
