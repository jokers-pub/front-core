import { AST, createFuntionBody } from "@joker.front/ast";
import { isEmptyStr, logger } from "@joker.front/shared";
import { GLOBAL_TAG, IParser } from "../parser";
import { VNode } from "../vnode";

export class ParserCode extends IParser<AST.PropertyOrFunctionCommand, VNode.Text | VNode.Html> {
    public parser(): void {
        if (isEmptyStr(this.ast.cmdName)) {
            logger.error(
                "Template Directive",
                "Error occurred while converting AST to VNode: Directive name not found",
                this.ast
            );
            throw new Error("Error converting AST to VNode: Directive name not found");
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
            let data = this.runExpressWithWatcher(
                `[${express}]`,
                this.ob,
                (newVal) => {
                    this.changeValue(newVal?.[0]);
                },
                false,
                () => {
                    return this.ast._code;
                }
            );

            data ||= [];

            if (this.ast.cmdName === "Html") {
                this.node = new VNode.Html(transformText(data[0]), this.parent, data[1]);
            } else {
                this.node = new VNode.Text(transformText(data[0]), this.parent);
            }

            this.appendNode();
            return;
        }

        throw new Error("Command not found: " + this.ast.cmdName);
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
