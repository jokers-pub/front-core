import { Component } from "../../src/component";
import { mountAst } from "../utils";

test("parser-comment", async () => {
    class Source extends Component {
        model = {};
    }

    let root = await mountAst(
        `
    // This is a comment
    /**
     * Code comments are the most important
     */
    <!-- I am also a comment -->
    `,
        new Source()
    );

    expect(root.innerHTML).toEqual(`
    // This is a comment
    /**
     * Code comments are the most important
     */
    <!-- I am also a comment -->`);
});