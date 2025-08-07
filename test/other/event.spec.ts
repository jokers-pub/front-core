import { sleep } from "@joker.front/shared";
import { Component, VNode } from "../../src";
import { getAst } from "../utils";

describe("Component Events", () => {
    it("Basic", async () => {
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

        component.$mount(root);
        await sleep(10);
        expect(mounted).toEqual(true);

        component.test("22");
        expect(tempVal).toEqual("22");

        component.$destroy(true);
        expect(destroy).toEqual(true);

        //Verify that the event is no longer broadcast.
        component.test("33");
        expect(tempVal).toEqual("22");
    });
});
