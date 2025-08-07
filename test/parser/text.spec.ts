import { Component } from "../../src/component";
import { ParserTemplate } from "../../src/parser/index";
import { createText } from "@joker.front/ast";
import { VNode } from "../../src/parser/vnode";
class TestView extends Component {
    model = {};
}
describe("text", () => {
    test("parser-text", async () => {
        let view = new TestView();

        let asts = [createText("123"), createText("I am a unit test.")];

        let templates = new ParserTemplate(asts, view);
        await templates.parser();
        let nodes = templates.root.childrens;

        expect(
            nodes.length === 2 &&
                nodes[0] instanceof VNode.Text &&
                nodes[1] instanceof VNode.Text &&
                nodes[1].text === "I am a unit test."
        ).toBe(true);
    });
});
