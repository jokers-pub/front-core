import { AST } from "@joker.front/ast";
import { IParser } from "./parser";
import { VNode } from "./vnode";

export class ParserText extends IParser<AST.Text, VNode.Text> {
    public parser(): void {
        this.node = new VNode.Text(this.ast.text, this.parent);

        this.appendNode();
    }
}
