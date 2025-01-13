import { Component, ShallowObserver, VNode } from "../../src";
import { getAst } from "../utils";

describe("同步pros", () => {
    it("基础功能测试", async () => {
        class ParentView extends Component<{ value: string }> {
            model = {
                temp: ""
            };
            template = function (h: any) {
                return getAst(`
                    <span>@model.temp</span>
                `);
            };
            mounted(): void {
                this.$syncProp("value", "temp");
            }
            test(str: string) {
                this.model.temp = str;
            }
        }

        let data = new ShallowObserver("ss");
        let root = document.createElement("div");
        let component = new ParentView(data).$mount(root);
        await component.$nextUpdatedRender();
        expect(root.innerHTML).toEqual("<span>ss</span>");

        component.test("gg");
        expect(root.innerHTML).toEqual("<span>gg</span>");

        data.value = "xx";
        expect(root.innerHTML).toEqual("<span>xx</span>");
    });
});
