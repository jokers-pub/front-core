import { Component, SCOPE_ID } from "../../src/component";
import { mountAst } from "../utils";
class SourceView extends Component {
    [SCOPE_ID] = "xxxxx";
    model = {
        content: "Hahahahahaha<i></i>"
    };
}
describe("html", () => {
    test("parser-html-sandbox", () => {
        let view = new SourceView();

        let root = mountAst(`@Html(model.content)`, view);

        //Enabling the sandbox makes it impossible to judge the internal text.
        expect(root.innerHTML).toBe('<joker-html-shadow style="line-height: 1;"></joker-html-shadow>');

        view.model.content = "<div>1</div>";

        expect(root.innerHTML).toBe('<joker-html-shadow style="line-height: 1;"></joker-html-shadow>');
    });

    test("parser-html", () => {
        let view = new SourceView();

        //Test scoped
        let root = mountAst(`@Html(model.content,true)`, view);

        //Enabling the sandbox makes it impossible to judge the internal text.
        expect(root.innerHTML).toBe(
            '<joker-html-container data-scoped-xxxxx="">Hahahahahaha<i data-scoped-xxxxx=""></i></joker-html-container>'
        );

        view.model.content = "<div>1</div>";

        expect(root.innerHTML).toBe(
            '<joker-html-container data-scoped-xxxxx=""><div data-scoped-xxxxx="">1</div></joker-html-container>'
        );
    });
});
