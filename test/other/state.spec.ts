import { Component } from "../../src/component";
import { getAst } from "../utils";
import { observer } from "../../src";

describe("State Management", () => {
    it("Basic", () => {
        let state = observer<{
            list: string[];
        }>({ list: [] });

        class ParentView extends Component {
            state = state;

            template = function (h: any) {
                return getAst(`
                @for(let item of state.list){
                    @item
                }
                `);
            };
        }

        class ParentView2 extends Component {
            state = state;

            template = function (h: any) {
                return getAst(`
                @for(let item1 of state.list){
                    @item1
                }
                `);
            };
        }

        let root = document.createElement("div");
        new ParentView().$mount(root);
        expect(root.innerHTML).toEqual(``);

        state.list.push("1");
        expect(root.innerHTML).toEqual(`1`);

        let root2 = document.createElement("div");
        new ParentView2().$mount(root2);
        expect(root2.innerHTML).toEqual(`1`);

        state.list.push("2");
        expect(root.innerHTML).toEqual(`12`);
        expect(root2.innerHTML).toEqual(`12`);
    });
});
