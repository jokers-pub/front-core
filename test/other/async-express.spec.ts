import { Component } from "../../src";
import { getAst, sleep } from "../utils";

describe("template", () => {
    it("基础", async () => {
        class ParentView extends Component {
            template = function () {
                return getAst(`<i param="@getParam()" ss="@model.val"></i><ChildrenView param="@getParam()" />`);
            };
            model = {
                val: "ssss"
            };
            components = {
                ChildrenView
            };

            async getParam() {
                let result = this.model.val + "1";
                await sleep(10);
                return result;
            }
        }

        class ChildrenView extends Component<{ param: string }> {
            template = function () {
                return getAst(`
                <span class="@getClass()">@props.param</span>
                `);
            };
            async getClass() {
                let value = this.props.param;
                await sleep(15);
                return value;
            }
        }

        let root = document.createElement("div");
        let component = await new ParentView().$mount(root);
        await component.$updatedRender();
        expect(root.innerHTML).toEqual('<i ss="ssss" param="ssss1"></i><span class="ssss1">ssss1</span>');

        component.model.val = "xxxxx";
        await sleep(50);
        expect(root.innerHTML).toEqual('<i ss="xxxxx" param="xxxxx1"></i><span class="xxxxx1">xxxxx1</span>');
    });
});
