import { createComponent } from "@joker.front/ast";
import { Component } from "../../src/component";
import { getAst } from "../utils";

describe("keepalive", () => {
    it("Basic", () => {
        class ParentView extends Component {
            isKeepAlive = true;
            model = {
                time: 0
            };

            template = function (h: any) {
                return getAst(`
        <span>@model.time</span>
        `);
            };

            sleeped() {
                this.model.time++;
            }
        }

        let root = document.createElement("div");
        let component = new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("<span>0</span>");
        component.$destroy();
        expect(root.innerHTML).toEqual("");
        component.$mount(root);
        expect(root.innerHTML).toEqual("<span>1</span>");
        // Force destroy
        component.$destroy(true);
        expect(root.innerHTML).toEqual("");
    });

    it("Reactive", async () => {
        class ParentView extends Component {
            public component?: Component;
            public async test() {
                this.component ??= new ChildrenView(undefined, undefined, true);
                await this.$render([createComponent(this.component)], true);
            }
        }

        class ChildrenView extends Component {
            public model = {
                time: 0
            };

            components = {
                ChildrenView1
            };

            template = function (h: any) {
                return getAst(`
        <span>@model.time</span>
        <ChildrenView1 />
        `);
            };

            sleeped() {
                this.model.time++;
            }
        }

        class ChildrenView1 extends Component {
            public model = {
                time: 0
            };

            template = function (h: any) {
                return getAst(`
        <span>@model.time</span>
        `);
            };

            // Verify sleep event passthrough
            sleeped() {
                this.model.time++;
            }
        }

        let root = document.createElement("div");
        let component = new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("");

        await component.test();
        expect(root.innerHTML).toEqual("<span>0</span><span>0</span>");

        await component.test();
        expect(root.innerHTML).toEqual("<span>1</span><span>1</span>");
        // Force destroy
        component.component?.$destroy(true);
        expect(root.innerHTML).toEqual("");
    });

    it("Component nesting usage", async () => {
        class ParentView extends Component {
            public components = {
                ChildrenView,
                ChildrenView2
            };
            model = {
                show: false
            };
            template = function (h: any) {
                return getAst(
                    `
                    @if(model.show){
                        <ChildrenView keep-alive>
                            <ChildrenView2></ChildrenView2>
                        </ChildrenView>
                    }
                `
                );
            };
        }

        class ChildrenView extends Component {
            public model = {
                time: 0
            };

            template = function (h: any) {
                return getAst(`
            @if(true){
            <span>@model.time</span>
            <div class="container">
                @RenderSection()
            </div>
            }
        `);
            };
            created() {
                this.model.time++;
            }
            wakeup() {
                this.model.time++;
            }
        }

        class ChildrenView2 extends Component {
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
        let component = new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("");
        component.model.show = true;
        expect(root.innerHTML).toEqual('<span>1</span><div class="container"><span>1</span></div>');
        // Test whether keepalive works after destroy and remount
        component.model.show = false;
        expect(root.innerHTML).toEqual("");
        component.model.show = true;
        expect(root.innerHTML).toEqual('<span>2</span><div class="container"><span>2</span></div>');

        // Retest
        component.model.show = false;
        component.model.show = true;
        expect(root.innerHTML).toEqual('<span>3</span><div class="container"><span>3</span></div>');

        component.$destroy(true);
        expect(root.innerHTML).toEqual("");
    });

    it("Command combination usage", () => {
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
            <Children2View keep-alive></Children2View>
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
        expect(root.innerHTML).toEqual("");
        component.model.show = true;
        expect(root.innerHTML).toEqual("<span>1</span>");
        // Test whether keepalive works after destroy and remount
        component.model.show = false;
        expect(root.innerHTML).toEqual("");
        component.model.show = true;
        expect(root.innerHTML).toEqual("<span>2</span>");

        // Retest
        component.model.show = false;
        component.model.show = true;
        expect(root.innerHTML).toEqual("<span>3</span>");

        component.$destroy(true);
        expect(root.innerHTML).toEqual("");
    });

    it("Sleep data update penetration", () => {
        class ParentView extends Component {
            public components = {
                ChildrenView
            };
            model = {
                show: false,
                time: 0
            };
            template = function (h: any) {
                return getAst(
                    `
                    @if(model.show){
                        <ChildrenView keep-alive time="@model.time"></Children2View>
                    }
                    @if(model.time>1){
                        <span>dynamic0</span>
                    }
                `
                );
            };
        }

        class ChildrenView extends Component<{ time: number }> {
            public model = {
                time: 0
            };

            public components = {
                ChildrenView2
            };

            template = function (h: any) {
                return getAst(`
            @if(true){
            <span>@model.time | @props.time</span>
            <div class="container">
                <ChildrenView2 time="@props.time"></ChildrenView2>
            </div>
            }
            @if(props.time>1){
                <span>dynamic1</span>
            }
        `);
            };
            created() {
                this.model.time++;
            }
            wakeup() {
                this.model.time++;
            }
        }

        class ChildrenView2 extends Component {
            public model = {
                time: 0
            };

            public propsType = {
                time: Number
            };

            template = function (h: any) {
                return getAst(`
            <span>@model.time | @props.time</span>
            @if(props.time>1){
                <span>dynamic2</span>
            }
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
        let component = new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("");
        component.model.show = true;
        expect(root.innerHTML).toEqual('<span>1 | 0</span><div class="container"><span>1 | 0</span></div>');
        // Test whether keepalive works after destroy and remount
        component.model.show = false;
        expect(root.innerHTML).toEqual("");
        component.model.time++;
        expect(root.innerHTML).toEqual("");
        component.model.show = true;
        expect(root.innerHTML).toEqual('<span>2 | 1</span><div class="container"><span>2 | 1</span></div>');

        // Retest
        component.model.show = false;
        component.model.time++;
        expect(root.innerHTML).toEqual("");
        component.model.show = true;
        expect(root.innerHTML).toEqual(
            '<span>3 | 2</span><div class="container"><span>3 | 2</span><span>dynamic2</span></div><span>dynamic1</span><span>dynamic0</span>'
        );

        component.$destroy(true);
        expect(root.innerHTML).toEqual("");
    });
});