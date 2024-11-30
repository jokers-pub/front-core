import { Component, VNode } from "../../src";
import { getAst } from "../utils";

describe("组件事件", () => {
    it("基础", async () => {
        let tempVal = "";
        let mounted = false;
        let destroy = false;
        class ParentView extends Component {
            template = function (h: any) {
                return getAst(`
                    <span></span>
                `);
            };

            test(val: string) {
                this.$trigger("temp", val);
            }
        }

        let root = document.createElement("div");
        let component = new ParentView();
        component.$on("temp", (e: VNode.Event<string>) => {
            tempVal = e.data || "";
        });
        component.$on("mounted", () => {
            mounted = true;
        });

        component.$on("destroy", () => {
            destroy = true;
        });

        await component.$mount(root);
        expect(mounted).toEqual(true);

        component.test("22");
        await component.$updatedRender();
        expect(tempVal).toEqual("22");

        component.$destroy(true);
        expect(destroy).toEqual(true);

        //验证事件不再广播
        component.test("33");
        await component.$updatedRender();
        expect(tempVal).toEqual("22");
    });
});
