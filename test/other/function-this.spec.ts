import { Component } from "../../src/component";
import { getAst } from "../utils";

describe("方法指针测试", () => {
    it("基础", () => {
        class ParentView extends Component {
            model = {
                a: 1
            };
            public components = {
                ChildrenCom
            };
            template = function (h: any) {
                return getAst(`
               <ChildrenCom callback="@([test])" sss="@(2) />
                `);
            };

            get ddd() {
                return (this.model.a += 1);
            }
            test() {
                this.model.a;
            }
        }

        class ChildrenCom extends Component<{ callback: Function[]; sss: number }> {
            protected created(): void {
                this.props.callback.forEach((n) => {
                    n();
                });
            }

            get ss() {
                return this.props.sss + 1;
            }
        }

        let root = document.createElement("div");
        let com = new ParentView();

        expect(() => com.$mount(root)).not.toThrowError();
    });
});
