import { createComponent } from "@joker.front/ast";
import { Component } from "../../src/component";
import { getAst } from "../utils";

describe("keepalive", () => {
    it("基础", async () => {
        class ParentView extends Component {
            model = {
                className: "a"
            };

            template = function (h: any) {
                return getAst(`
                <span ref="demo" class="@model.className"></span>
                `);
            };

            updateCount = 0;
            public mounted(): void {
                this.$watchNode("demo", (node, type, propertyKey) => {
                    this.updateCount++;
                });
            }

            setValue(val: string) {
                this.model.className = val;
            }
        }

        let root = document.createElement("div");
        let component = await new ParentView().$mount(root);
        expect(root.innerHTML).toEqual(`<span class="a"></span>`);

        component.setValue("b");
        expect(root.innerHTML).toEqual(`<span class="b"></span>`);
        expect(component.updateCount).toEqual(1);

        component.setValue("b");
        expect(root.innerHTML).toEqual(`<span class="b"></span>`);
        expect(component.updateCount).toEqual(1);
    });
});
