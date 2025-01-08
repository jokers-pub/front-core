import { Component } from "../../src/component";
import { getAst, sleep } from "../utils";

describe("if 响应测试", () => {
    it("双属性同时变更", async () => {
        class ParentView extends Component<{
            mini?: boolean;
            codeBlock?: boolean;
            placeholder?: string;
        }> {
            propsOption = {
                placeholder: "请输入内容"
            };
            model = {
                value: "",
                focus: false
            };

            template = function (h: any) {
                return getAst(`
                    @if(!model.value && !model.focus) {
                        <div class="placeholder" style="@({ paddingLeft: props.mini ? undefined : '20px', left: props.codeBlock ? '30px' : undefined })">
                            @props.placeholder
                        </div>
                    }
                `);
            };
        }

        let root = document.createElement("div");
        let com = await new ParentView({
            codeBlock: true
        }).$mount(root);

        com.model.focus = true;
        await sleep(200);
        com.model.focus = false;
        com.model.value = "123";
        await com.$updatedRender();
        expect(root.innerHTML).toEqual("");
    });
    it("频繁值变更", async () => {
        class ParentView extends Component {
            model = {
                a: true
            };

            template = function (h: any) {
                return getAst(`
                    @if(model.a){
                        <span>1</span>
                    }
                    else{
                        <span>2</span>
                    }
                `);
            };
        }

        let root = document.createElement("div");
        let com = await new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("<span>1</span>");
        com.model.a = false;
        com.model.a = true;
        await com.$updatedRender();
        expect(root.innerHTML).toEqual("<span>1</span>");
        com.model.a = false;
        com.model.a = true;
        com.model.a = false;
        await com.$updatedRender();
        expect(root.innerHTML).toEqual("<span>2</span>");
    });
    it("基础", async () => {
        class ParentView extends Component {
            model: any = {
                a: {
                    title: "xxxx"
                }
            };

            template = function (h: any) {
                return getAst(`
                    @if(model.a){
                            @model.a.title
                    }
                `);
            };
        }

        let root = document.createElement("div");
        let com = await new ParentView().$mount(root);

        expect(root.innerHTML).toEqual("xxxx");

        com.model.a = undefined;
        expect(root.innerHTML).toEqual("");
    });
    it("基础1", async () => {
        class ParentView extends Component {
            model: any = {
                a: undefined
            };
            public components = {
                ChildrenView
            };
            template = function (h: any) {
                return getAst(`
                    @if(model.a && model.a.length){
                        1
                    }
                    else if(model.a && model.a.length===0){
                        <ChildrenView />
                    }
                `);
            };
        }
        class ChildrenView extends Component<{ param: string }> {
            template = function () {
                return getAst(`
                <span></span>
                `);
            };
            async created() {
                await sleep(15);
            }
        }

        let root = document.createElement("div");
        let com = await new ParentView().$mount(root);

        expect(root.innerHTML).toEqual("");

        com.model.a = [1, 2];
        expect(root.innerHTML.trim()).toEqual("1");

        com.model.a.push(3);
        expect(root.innerHTML.trim()).toEqual("1");

        com.model.a = [];
        await sleep(15);
        com.model.a.push(1);
        expect(root.innerHTML.trim()).toEqual("1");
    });

    it("基础2", async () => {
        class ParentView extends Component {
            model: any = {
                a: {
                    title: "xxxx"
                }
            };
            components = {
                ChildView
            };
            template = function (h: any) {
                return getAst(`
               @if(model.a){
                   <ChildView ss="@model.a.title"> </ChildView>
               }
                `);
            };
        }

        class ChildView extends Component<{ ss: string }> {
            template = function (h: any) {
                return getAst(`
              @props.ss
                `);
            };
        }

        let root = document.createElement("div");
        let com = await new ParentView().$mount(root);

        expect(root.innerHTML).toEqual("xxxx");

        com.model.a = undefined;
        expect(root.innerHTML).toEqual("");
    });
});
