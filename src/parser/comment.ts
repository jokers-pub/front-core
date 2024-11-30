import { AST } from "@joker.front/ast";
import { IParser } from "./parser";
import { VNode } from "./vnode";

export class ParserComment extends IParser<AST.Comment, VNode.Comment> {
    public parser(): void {
        this.node = new VNode.Comment(this.ast.text, this.parent);

        this.appendNode();
    }
}
