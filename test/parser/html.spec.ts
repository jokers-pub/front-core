import { Component, SCOPE_ID } from "../../src/component";
import { mountAst } from "../utils";
class SourceView extends Component {
    [SCOPE_ID] = "xxxxx";
    model = {
        content: "哈哈哈哈哈哈<i></i>"
    };
}
describe("html", () => {
    test("parser-html-sandbox", () => {
        let view = new SourceView();

        let root = mountAst(`@Html(model.content)`, view);

        //开启沙箱 无法判断内部文本
        expect(root.innerHTML).toBe('<joker-html-shadow style="line-height: 1;"></joker-html-shadow>');

        view.model.content = "<div>1</div>";

        expect(root.innerHTML).toBe('<joker-html-shadow style="line-height: 1;"></joker-html-shadow>');
    });

    test("parser-html", () => {
        let view = new SourceView();

        //测试 scoped
        let root = mountAst(`@Html(model.content,true)`, view);

        //开启沙箱 无法判断内部文本
        expect(root.innerHTML).toBe(
            '<joker-html-container data-scoped-xxxxx="">哈哈哈哈哈哈<i data-scoped-xxxxx=""></i></joker-html-container>'
        );

        view.model.content = "<div>1</div>";

        expect(root.innerHTML).toBe(
            '<joker-html-container data-scoped-xxxxx=""><div data-scoped-xxxxx="">1</div></joker-html-container>'
        );
    });
});
