import { Component } from "../../src/component";
import { getAst } from "../utils";

describe("template", () => {
    it("基础", () => {
        class ParentView extends Component {
            template = function () {
                return getAst(`
                    <template>
                        <input />
                        <ChildrenView></ChildrenView>
                    </template>
                `);
            };

            components = {
                ChildrenView
            };
        }

        class ChildrenView extends Component {
            model = {
                time: 0
            };

            template = function () {
                return getAst(`
                <span>@model.time</span>
                `);
            };
        }

        let root = document.createElement("div");
        new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("<input><span>0</span>");
    });

    it("keepalive 保活", () => {
        class Parent2View extends Component {
            public components = {
                Children2View
            };
            model = {
                show: false
            };
            template = function (h: any) {
                return getAst(
                    `
        @if(model.show){
            <template keep-alive>
                1234<Children2View></Children2View>
            </template>
        }
        `
                );
            };
        }

        class Children2View extends Component {
            public model = {
                time: 0
            };

            template = function (h: any) {
                return getAst(`
        <span>@model.time</span>
        `);
            };
            created() {
                this.model.time++;
            }
            wakeup() {
                this.model.time++;
            }
        }

        let root = document.createElement("div");
        let component = new Parent2View().$mount(root);
        expect(root.innerHTML.trim()).toEqual("");
        component.model.show = true;

        expect(root.innerHTML.trim()).toEqual("1234<span>1</span>");

        //测试销毁再挂载是否keepalive
        component.model.show = false;
        expect(root.innerHTML.trim()).toEqual("");

        component.model.show = true;
        expect(root.innerHTML.trim()).toEqual("1234<span>2</span>");

        //复测
        component.model.show = false;
        component.model.show = true;
        expect(root.innerHTML.trim()).toEqual("1234<span>3</span>");

        component.$destroy(true);
        expect(root.innerHTML.trim()).toEqual("");
    });
});
