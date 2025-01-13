import { sleep } from "@joker.front/shared";
import { VNode } from "../../src";
import { Component, ComponentContainer } from "../../src/component";

import { getAst } from "../utils";

describe("template", () => {
    it("基础", async () => {
        class ParentView extends Component {
            template = function () {
                return getAst(`
                    <component name="@model.cmp" param="@model.param" />
                `);
            };
            model = {
                cmp: "",
                param: "Zohar"
            };

            public components = {
                ChildrenView,
                ChildrenView2
            };

            test() {
                this.model.cmp = "ChildrenView";
            }

            test2() {
                this.model.cmp = "ChildrenView2";
            }

            test3() {
                this.model.param = "hello";
            }
        }

        class ChildrenView extends Component {
            template = function () {
                return getAst(`
                <span>我是组件1</span>
                `);
            };
        }

        class ChildrenView2 extends Component<{ param: string }> {
            template = function () {
                return getAst(`
                <span>我是组件2+@props.param</span>
                `);
            };
        }

        let root = document.createElement("div");
        let component = new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("");

        component.test2();
        await sleep(100);
        expect(root.innerHTML).toEqual("<span>我是组件2+Zohar</span>");

        component.test3();
        expect(root.innerHTML).toEqual("<span>我是组件2+hello</span>");

        component.$destroy();
        expect(root.innerHTML).toEqual("");
    });

    it("保活", async () => {
        class ParentView extends Component {
            template = function () {
                return getAst(`
                    <component ref='cmp' name="@model.cmp" keep-alive />
                `);
            };
            model = {
                cmp: ""
            };

            public components = {
                ChildrenView,
                ChildrenView2
            };

            test() {
                this.model.cmp = "ChildrenView";
            }

            test2() {
                this.model.cmp = "ChildrenView2";
            }
        }

        class ChildrenView extends Component {
            template = function () {
                return getAst(`
                <span>我是组件1@model.time</span>
                `);
            };

            model = {
                time: 0
            };

            sleeped() {
                this.model.time++;
            }
        }

        class ChildrenView2 extends Component {
            template = function () {
                return getAst(`
                <span>我是组件2@model.time</span>
                `);
            };
            model = {
                time: 0
            };
            sleeped() {
                this.model.time++;
            }
        }

        let root = document.createElement("div");
        let component = new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("");

        component.test();
        await sleep(100);
        expect(root.innerHTML).toEqual("<span>我是组件10</span>");

        component.test2();
        await sleep(100);
        expect(root.innerHTML).toEqual("<span>我是组件20</span>");

        component.test();
        await sleep(100);
        expect(root.innerHTML).toEqual("<span>我是组件11</span>");

        component.test2();
        await sleep(100);
        expect(root.innerHTML).toEqual("<span>我是组件21</span>");

        //清除ChildrenView 缓存
        component.$getRef<VNode.Component<ComponentContainer>>("cmp")?.component?.removeCache("ChildrenView");

        component.test();
        await sleep(100);
        expect(root.innerHTML).toEqual("<span>我是组件10</span>");

        component.test2();
        await sleep(100);
        expect(root.innerHTML).toEqual("<span>我是组件22</span>");

        component.$destroy();
        expect(root.innerHTML).toEqual("");
    });

    it("容器穿透渲染", () => {
        //主要测试，插槽作为参数穿透传递渲染，非常规
        class Com1 extends Component {
            template = function () {
                return getAst(`
                    <Com2>
                    @section('test',data){
                        <b>@data.value</b>
                    }
                    </Com2>
                `);
            };

            public components = {
                Com2
            };
        }

        class Com2 extends Component {
            template = function () {
                return getAst(`
                <span>
                    @RenderSection($sections.test,{value:model.v1})
                </span>
                `);
            };
            model = {
                v1: "1"
            };
        }

        let root = document.createElement("div");
        new Com1().$mount(root);
        expect(root.innerHTML).toEqual("<span><b>1</b></span>");
    });

    it("容器子区域加载", () => {
        //主要测试，插槽作为参数穿透传递渲染，非常规
        class Com1 extends Component {
            model = {
                arr: [{ childrens: [1] }]
            };
            template = function () {
                return getAst(`
                @for(let item of model.arr){
                    <Com2>
                        @for(let children of item.childrens){
                            <b>@children</b>
                        }
                    </Com2>
                }
                `);
            };

            components = {
                Com2
            };
        }

        class Com2 extends Component {
            template = function () {
                return getAst(`
                <span>
                    @RenderSection()
                </span>
                `);
            };
        }

        let root = document.createElement("div");
        let component = new Com1().$mount(root);
        expect(root.innerHTML).toEqual("<span><b>1</b></span>");

        component.model.arr[0].childrens.push(2);
        expect(root.innerHTML).toEqual("<span><b>1</b><b>2</b></span>");
    });

    it("ref 异步组件加载验证", async () => {
        //主要测试，插槽作为参数穿透传递渲染，非常规
        let test = 0;
        class Com1 extends Component {
            model = {
                arr: [{ childrens: [1] }]
            };
            template = function () {
                return getAst(`
                @for(let item of model.arr){
                    <Com2>
                        @for(let children of item.childrens){
                            <b ref="b">@children</b>
                        }
                    </Com2>
                }
                `);
            };

            components = {
                Com2: async () => {
                    await sleep(10);
                    return { default: Com2 };
                }
            };
            mounted() {
                test = this.$refs.b.length;
            }
        }

        class Com2 extends Component {
            template = function () {
                return getAst(`
                <span>
                    @RenderSection()
                </span>
                `);
            };
        }

        let root = document.createElement("div");
        let component = new Com1().$mount(root);
        await component.$nextUpdatedRender();

        expect(root.innerHTML).toEqual("<span><b>1</b></span>");
        expect(component.$refs.b.length).toEqual(1);
        expect(test).toEqual(1);
        component.model.arr[0].childrens.push(2);
        expect(root.innerHTML).toEqual("<span><b>1</b><b>2</b></span>");
    });
});
