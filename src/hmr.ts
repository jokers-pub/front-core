import { VNode } from "./index";
import { Component, ComponentConstructor, TemplateType } from "./component";
import { ParserComponent } from "./parser/component";

const HMR_MAP: Map<string, Set<Component>> = new Map();
const HMR_RENDER_MAP: Map<string, { render: TemplateType }> = new Map();
const HMR_COMPONENT_MAP: Map<string, { component: ComponentConstructor }> = new Map();
/**
 * 热更新助手（热更新使用）(构建时会按需剔除)
 */
export let __JOKER_HMR_RUNTIME = {
    recordRender: (id: string, template: { render: TemplateType }) => {
        HMR_RENDER_MAP.set(id, template);
    },

    recordComponent: (id: string, component: { component: ComponentConstructor }) => {
        HMR_COMPONENT_MAP.set(id, component);
    },

    record: (id: string, component: Component) => {
        if (HMR_MAP.get(id) === undefined) {
            HMR_MAP.set(id, new Set());
        }
        HMR_MAP.get(id)!.add(component);

        component.$on("destroy", () => {
            HMR_MAP.get(id)?.delete(component);
        });
    },

    reload: (id: string, component: ComponentConstructor) => {
        let recode = HMR_COMPONENT_MAP.get(id);
        if (!recode) return;

        //1. 更新值
        recode.component = component;

        //2. 更新已渲染的
        let rendered = HMR_MAP.get(id);

        if (!rendered) return;
        let reloadRecodes = Array.from(rendered);

        //刷新/重载组件时会重新完成map绘制
        rendered.clear();

        //引用类型存在循环
        reloadRecodes.forEach((c) => {
            //未被销毁
            if (c.$root) {
                if (c.$rootVNode?.parent) {
                    let parent = c.$rootVNode.parent;
                    if (
                        parent instanceof VNode.Component &&
                        parent[VNode.PARSERKEY] &&
                        //直接指向内存的组件，无法重新实例化
                        (parent[VNode.PARSERKEY] as ParserComponent).canReload
                    ) {
                        (parent[VNode.PARSERKEY] as ParserComponent).reload();
                    } else {
                        window.onbeforeunload = null;
                        //无法更新
                        location.reload();
                        return;
                    }
                } else {
                    window.onbeforeunload = null;
                    //无根的话只能重载
                    location.reload();
                    return;
                }
            }
        });
    },

    rerender: (id: string, template: TemplateType) => {
        let prevRender = HMR_RENDER_MAP.get(id);
        //更新render根方法，以实现未实例化的组件更新
        if (prevRender) {
            prevRender.render = template;
        }
        //完成已实例化的组件的更新
        HMR_MAP.get(id)?.forEach((c) => {
            c.$render(template);
        });
    }
};
