import { Component } from "../../src/component";
import { getAst, sleep } from "../utils";

describe("if reactive test", () => {
    it("Simultaneous change of two properties", async () => {
        class ParentView extends Component<{
            mini?: boolean;
            codeBlock?: boolean;
            placeholder?: string;
        }> {
            propsOption = {
                placeholder: "Please enter content"
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
        let com = new ParentView({
            codeBlock: true
        }).$mount(root);

        com.model.focus = true;
        await sleep(200);
        com.model.focus = false;
        com.model.value = "123";

        expect(root.innerHTML).toEqual("");
    });
    it("Frequent value changes", () => {
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
        let com = new ParentView().$mount(root);
        expect(root.innerHTML).toEqual("<span>1</span>");
        com.model.a = false;
        com.model.a = true;
        expect(root.innerHTML).toEqual("<span>1</span>");
        com.model.a = false;
        com.model.a = true;
        com.model.a = false;
        expect(root.innerHTML).toEqual("<span>2</span>");
    });
    it("Basic", () => {
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
        let com = new ParentView().$mount(root);

        expect(root.innerHTML).toEqual("xxxx");

        com.model.a = undefined;
        expect(root.innerHTML).toEqual("");
    });
    it("Basic 1", () => {
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
        }

        let root = document.createElement("div");
        let com = new ParentView().$mount(root);

        expect(root.innerHTML).toEqual("");

        com.model.a = [1, 2];
        expect(root.innerHTML.trim()).toEqual("1");

        com.model.a.push(3);
        expect(root.innerHTML.trim()).toEqual("1");

        com.model.a = [];

        com.model.a.push(1);
        expect(root.innerHTML.trim()).toEqual("1");
    });

    it("Basic 2", () => {
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
        let com = new ParentView().$mount(root);

        expect(root.innerHTML).toEqual("xxxx");

        com.model.a = undefined;
        expect(root.innerHTML).toEqual("");
    });
});