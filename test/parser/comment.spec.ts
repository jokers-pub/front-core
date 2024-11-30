import { Component } from "../../src/component";
import { mountAst } from "../utils";

test("parser-comment", async () => {
    class Source extends Component {
        model = {};
    }

    let root = await mountAst(
        `
    // 这事一个注释
    /**
     * 代码注释最重要
     */
    <!-- 我也是一个注释 -->
    `,
        new Source()
    );

    expect(root.innerHTML).toEqual(`
    // 这事一个注释
    /**
     * 代码注释最重要
     */
    <!-- 我也是一个注释 -->`);
});
