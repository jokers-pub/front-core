import { AST } from "@joker.front/ast";
import { defineObserverProperty } from "../../observer";
import { IParser } from "../parser";
import { VNode } from "../vnode";
export const DEFAULT_SECTION_TAG = "default";

export class ParserRenderSection extends IParser<AST.PropertyOrFunctionCommand, VNode.RenderSection> {
    public async parser() {
        let paramData = this.transformParam();

        this.node = new VNode.RenderSection(paramData.id, this.parent);

        this.node.params = paramData.params;

        this.node.section ??= this.ob.$sections?.[paramData.id];

        this.appendNode();

        if (this.node.section) {
            /**
             * section 挂载子组件中
             *
             * ob是父组件渲染组件时的ob，在此之上，添加一些param
             * 然后用当前组件的parser+新的ob去渲染
             *
             * 渲染出来的子集属于组件的子集
             */

            if (this.node.section.params) {
                this.node.ob = Object.create(this.node.section.ob || this.ob);

                this.node.section.params?.forEach((item, index) => {
                    defineObserverProperty(this.node!.ob, item, this.node!.params[index]);
                });
            } else {
                //无参数 不需要创建新的对象，避免性能开销
                this.node.ob = this.node.section.ob || this.ob;
            }

            //使用之前的node.parser去渲染
            await (this.node.section.parser || this.ext).parserNodes(this.node.section.asts, this.node, this.node.ob);
        }
    }

    private transformParam() {
        if (this.ast.param) {
            let expressVal = this.runExpressWithWatcher(`[${this.ast.param}]`, this.ob, (newVal) => {
                let newSectionId = newVal?.[0] || DEFAULT_SECTION_TAG;

                if (typeof newSectionId === "string" && newSectionId !== this.node!.id) {
                    throw new Error("section id 不可动态变更");
                }

                this.node!.params = newVal.slice(1);

                if (this.node?.ob && this.node.section) {
                    this.node.section.params?.forEach((item, index) => {
                        if (this.node?.ob) {
                            if (this.node.ob[item] !== this.node.params[index]) {
                                this.node.ob[item] = this.node.params[index];
                            }
                        }
                    });
                }
            });

            return {
                id: expressVal?.[0] || DEFAULT_SECTION_TAG,
                params: expressVal?.slice(1) || []
            };
        } else {
            return {
                id: DEFAULT_SECTION_TAG,
                params: []
            };
        }
    }
}
