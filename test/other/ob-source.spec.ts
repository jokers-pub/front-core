import { Component } from "../../src/component";
import { getAst } from "../utils";
import { VNode, observer } from "../../src";

describe("Traceability of db pollution during parser", () => {
    it("Basic", async () => {
        class ParentView extends Component {
            list = [1];
            val?: number;
            template = function (h: any) {
                return getAst(`
                    @for(let item of list){
                        <span @click="handleClick(item)"><span>
                    }
                `);
            };
            handleClick(e: VNode.Event, val: number) {
                this.val = val;
            }
        }

        let root = document.createElement("div");
        let view = await new ParentView().$mount(root);

        root.querySelector("span")?.click();

        expect(view.val).toEqual(1);
    });
});
