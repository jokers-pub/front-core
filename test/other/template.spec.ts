import { Component } from "../../src/component";
import { getAst } from "../utils";

describe("template", () => {
    it("Basic", () => {
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

    it("keepalive persistence", () => {
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

        //Test whether keepalive works when destroyed and then remounted.
        component.model.show = false;
        expect(root.innerHTML.trim()).toEqual("");

        component.model.show = true;
        expect(root.innerHTML.trim()).toEqual("1234<span>2</span>");

        //Retest
        component.model.show = false;
        component.model.show = true;
        expect(root.innerHTML.trim()).toEqual("1234<span>3</span>");

        component.$destroy(true);
        expect(root.innerHTML.trim()).toEqual("");
    });

    it("template ref firstElement should find element inside RenderSection", async () => {
        class ParentView extends Component {
            template = function () {
                return getAst(`
                    <template ref="content">
                        <ChildComponent>
                            <div class="slot-content">插槽内容</div>
                        </ChildComponent>
                    </template>
                `);
            };

            components = {
                ChildComponent
            };
        }

        class ChildComponent extends Component {
            template = function () {
                return getAst(`
                    <div class="child-wrapper">
                        @RenderSection()
                    </div>
                `);
            };
        }

        let root = document.createElement("div");
        let component = new ParentView().$mount(root);

        await component.$nextUpdatedRender();

        // 验证渲染结果正确
        expect(root.innerHTML).toEqual('<div class="child-wrapper"><div class="slot-content">插槽内容</div></div>');

        // 直接获取ref并验证firstElement
        const contentTpl = component.$getRef("content");
        expect(contentTpl).not.toBeUndefined();
        const firstElement = contentTpl?.firstElement;
        expect(firstElement).not.toBeUndefined();
        expect(firstElement?.attributes.class).toEqual("child-wrapper");
        expect(firstElement?.output).not.toBeUndefined();
        expect(firstElement?.output?.className).toEqual("child-wrapper");

        component.$destroy();
    });
});
