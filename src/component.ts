import { AST, IComponent, RENDER_HANDLER, createCommand, createComponent } from "@joker.front/ast";
import { logger, remove, toLowerCase } from "@joker.front/shared";
import { observer } from "./observer";
import { BREAK_WATCH_UPDATE, Watcher } from "./observer/watcher";
import { NodeChangeType, ParserTemplate } from "./parser";
import { VNode } from "./parser/vnode";
import { PropType, getPropValue } from "./props";
import { isGetterProperty } from "./utils";

const LOGTAG = "组件";
const PROPS_DATA_KEY = Symbol.for("JOKER_PROPS_DATA_KEY");
const PROPS_DATA_PROXY = Symbol.for("JOKER_PROPS_DATA_PROXY");
const PRIVATE_WATCHERS = Symbol.for("JOKER_PRIVATE_WATCHERS");
const EVENT_DATA_KEY = Symbol.for("JOKER_EVENT_DATA_KEY");
export const IS_DESTROY = Symbol.for("JOKER_IS_DESTROY");

export const PARSER_TEMPLATE_TARGET = Symbol.for("JOKER_PARSER_TEMPLATE_TARGET");

export type TemplateType = Array<AST.Node> | ((h: typeof RENDER_HANDLER) => Array<AST.Node>);

export const SCOPE_ID = Symbol.for("JOKER_SCOPE_ID");

export const JOKER_COMPONENT_TAG = Symbol.for("JOKER_COMPONENT_TAG");

const TRANSFORM_FUNCTION_FLAG = Symbol();

export type ComponentConstructor = typeof Component<any>;

export type ImportComponentConstructor = () => Promise<{ default: ComponentConstructor }>;

export type SectionType = {
    asts: AST.Node[];
    ob?: Component & Record<string, any>;
    parser?: ParserTemplate;
    params?: string[];
};

type DefaultKeyVal = Record<string | symbol, any>;

let componentFunctionPropertyNames = [
    "constructor",
    "$mount",
    "$nodeTransition",
    "$destroy",
    "$getRef",
    "$getRefs",
    "$syncProp",
    "$watchNode",
    "$watch",
    "$on",
    "$off",
    "$trigger",
    "$render",
    "created",
    "mounted",
    "beforeDestroy",
    "sleeped",
    "wakeup",
    "destroyed"
];

/**
 * Joker组件
 */
export class Component<T extends DefaultKeyVal = {}> implements IComponent {
    static [JOKER_COMPONENT_TAG] = true;

    /**
     * scopeId 配合css：Scoped
     */
    public [SCOPE_ID]?: string;

    /**
     * 可观察数据（具备劫持观察能力）
     */
    public model: DefaultKeyVal = {};

    /**
     * 渲染模板
     */
    public template?: TemplateType;

    /**
     * 挂载根
     */
    public $root: any;

    /**
     * 是否已睡眠
     */
    public isSleeped: boolean = false;
    /**
     * 可用的声明组件
     */
    public components: Record<string, ComponentConstructor | ImportComponentConstructor> = {};

    /**
     * props辅助约束
     * @example { name:"默认值",age:Number }
     * 可以配置默认值，也可以配置为约束，类型参考PropType
     */
    public propsOption?: Partial<Record<keyof T, PropType | any>>;

    private [PROPS_DATA_KEY]: Readonly<Record<string, any>> = {};

    private [PARSER_TEMPLATE_TARGET]?: ParserTemplate;

    private [PROPS_DATA_PROXY]?: Record<string, any>;

    private [PRIVATE_WATCHERS]: Watcher<any>[] = [];

    private [EVENT_DATA_KEY]: Map<string, Set<VNode.EventCallBack>> = new Map();

    private [IS_DESTROY] = false;

    //方法转换标记
    private [TRANSFORM_FUNCTION_FLAG] = false;
    /**
     * @param propData prop参数
     * @param sections 渲染部分区域
     * @param isKeepAlive 是否要保持存活，启用时再destroy时只会销毁UI部分，不会销毁数据，直到使用destroy(true)才会销毁
     */
    constructor(
        propData?: T,
        public $sections: Record<string, SectionType> = {},
        public readonly isKeepAlive?: boolean
    ) {
        this[PROPS_DATA_KEY] = propData || {};
    }

    /**
     * 主动声明接受的参数
     * @returns
     */
    public get props(): Readonly<T> {
        if (this[PROPS_DATA_PROXY] === undefined) {
            let self = this;

            this[PROPS_DATA_PROXY] = new Proxy(self[PROPS_DATA_KEY], {
                get(target, p: string) {
                    return getPropValue(self[PROPS_DATA_KEY], p, self.propsOption);
                },
                set() {
                    throw new Error("props 参数不允许变更，只允许单向数据传递");
                }
            });
        }

        return this[PROPS_DATA_PROXY] as T;
    }

    /**
     * 挂载
     * @param root
     */
    public $mount(root: any | VNode.Component): this {
        if (this[TRANSFORM_FUNCTION_FLAG] === false) {
            let getAllChildFuncProperties = () => {
                let childMethods: string[] = [];
                let currentObj = Object.getPrototypeOf(this);
                while (currentObj !== null && currentObj !== Object.prototype) {
                    Object.getOwnPropertyNames(currentObj).forEach((property) => {
                        if (
                            //排除构造函数以及内部函数
                            componentFunctionPropertyNames.includes(property) === false &&
                            //排除get 属性
                            !isGetterProperty(currentObj, property) &&
                            typeof currentObj[property] === "function" &&
                            //排除class
                            !currentObj[property].prototype?.hasOwnProperty("constructor")
                        ) {
                            childMethods.push(property);
                        }
                    });
                    currentObj = Object.getPrototypeOf(currentObj);
                }
                return childMethods;
            };

            //更改function this 指针
            for (let name of getAllChildFuncProperties()) {
                this[name as keyof this] = (this[name as keyof this] as Function).bind(this);
            }
            this[TRANSFORM_FUNCTION_FLAG] = true;
        }

        this.$root = root;

        //从睡眠中醒来
        if (this.isKeepAlive && this.isSleeped) {
            this.isSleeped = false;

            if (this[PARSER_TEMPLATE_TARGET] && this.$root) {
                this[PARSER_TEMPLATE_TARGET].mount(this.$root);
            } else {
                logger.error(LOGTAG, `当前组件在唤醒时，发现渲染处理程序已被销毁，无法进行唤醒操作`, [
                    this,
                    this.$root
                ]);
                return this;
            }

            this.wakeup();
            this.$trigger("wakeup");

            this.$rootVNode && weakupNotify(this.$rootVNode);

            return this;
        }

        this.isSleeped = false;

        this.model = observer(this.model);

        let createdPromise = this.created();

        let next = async () => {
            this.$trigger("created");

            //有模板则执行render，否则不处理
            this.template && this.$render();

            await this.$nextUpdatedRender();

            if (this[IS_DESTROY]) return;

            await this.mounted();
            if (this[IS_DESTROY]) return;

            this.$trigger("mounted");
        };
        if (createdPromise && createdPromise instanceof Promise) {
            createdPromise.then(() => {
                if (this[IS_DESTROY]) return;
                next();
            });
        } else {
            next();
        }

        return this;
    }

    public $nextUpdatedRender(callBack?: Function) {
        if (this[IS_DESTROY]) return;
        return new Promise((resolve) => {
            let checkPromise = async () => {
                await Promise.resolve();
                //收集此刻异步渲染（含子集）
                let promiseQueue: Array<Promise<any>> = [...(this[PARSER_TEMPLATE_TARGET]?.promiseQueue || [])];
                let childrens: any = this.$rootVNode?.find((n) => n instanceof VNode.Component);
                childrens?.forEach((n: any) => {
                    n?.component && promiseQueue.push(...(n.component[PARSER_TEMPLATE_TARGET]?.promiseQueue || []));
                });
                if (promiseQueue.length) {
                    Promise.all(promiseQueue).finally(() => {
                        if (this[IS_DESTROY]) return;
                        callBack?.();
                        resolve(undefined);
                    });
                } else {
                    if (this[IS_DESTROY]) return;
                    callBack?.();
                    resolve(undefined);
                }
            };

            //等待异步，收集
            setTimeout(() => {
                checkPromise();
            });
        });
    }

    /**
     * 节点动画，仅支持 element及组件节点
     */
    public $nodeTransition(
        nodeOrRef: string | VNode.Node,
        mode: "enter" | "leave",
        name?: string,
        callBack?: Function,
        type?: "transition" | "animation"
    ): void {
        if (typeof nodeOrRef === "string") {
            let vnode = this.$getRef(nodeOrRef);

            if (vnode) {
                nodeOrRef = vnode;
            } else {
                logger.error(LOGTAG, `执行节点动画是找不到ref=${nodeOrRef}的节点`);
                return;
            }
        }
        this[PARSER_TEMPLATE_TARGET]?.nodeTransition(nodeOrRef, mode, name, callBack, type);
    }

    /**
     * 销毁
     */
    public $destroy(force?: boolean) {
        if (!force && this.isKeepAlive) {
            this[PARSER_TEMPLATE_TARGET]?.sleep();

            this.isSleeped = true;

            this.sleeped();
            this.$trigger("sleeped");

            this.$rootVNode && sleepNotify(this.$rootVNode);

            return;
        }

        this[IS_DESTROY] = true;

        //#region  清除组件内监听和模板编译内的监听
        for (let watcher of this[PRIVATE_WATCHERS]) {
            watcher.destroy();
        }

        this[PRIVATE_WATCHERS].length = 0;

        this[PARSER_TEMPLATE_TARGET]?.destroyWathcers();
        //#endregion

        this.beforeDestroy();
        this.$trigger("beforeDestroy");

        this[PARSER_TEMPLATE_TARGET]?.destroy();

        this[PARSER_TEMPLATE_TARGET] = undefined;

        if (this.template && Array.isArray(this.template)) {
            this.template.length = 0;
        }

        this.$trigger("destroy");

        this[EVENT_DATA_KEY].clear();

        this.$root = undefined;

        this.isSleeped = false;

        this.$sections = {};

        this[PROPS_DATA_PROXY] = undefined;

        this[PROPS_DATA_KEY] = {};

        this.destroyed();
    }

    /**
     * VNode ref索引集
     */
    public get $refs(): Readonly<Record<string, Array<VNode.Node>>> {
        return this[PARSER_TEMPLATE_TARGET]?.refs || {};
    }

    /**
     * 根据ref获取单个VNode
     */
    public $getRef<T extends VNode.Node = VNode.Element & VNode.Component>(ref: string): T | undefined {
        return this.$refs[ref]?.[0] as T;
    }

    /**
     * 获取相同ref的VNode集合
     */
    public $getRefs<T extends VNode.Node = VNode.Element & VNode.Component>(ref: string): Array<T> | undefined {
        return this.$refs[ref] as T[];
    }

    /**
     * 单向同步prop值，并监听变更后重新同步
     * @param propKey 需要观察同步的props key
     * @param modelKey 要赋值的model key，不传案prop key 进行赋值
     * @param convertVal 值转换方法
     */
    public $syncProp(propKey: keyof T): void;
    public $syncProp(propKey: keyof T, modelKey: string): void;
    public $syncProp(propKey: keyof T, convertVal: (val: any) => any): void;
    public $syncProp(propKey: keyof T, modelKey: string, convertVal: (val: any) => any): void;
    public $syncProp(propKey: keyof T, modelKey?: string | ((val: any) => any), convertVal?: (val: any) => any): void {
        if (typeof modelKey === "function") {
            convertVal = modelKey;
            modelKey = undefined;
        }

        modelKey ??= propKey as string;
        convertVal ??= (val: any) => {
            return val;
        };
        //先做一次同步再去观察
        this.model[modelKey] = convertVal(this.props[propKey]);

        this.$watch(
            () => this.props[propKey],
            () => {
                this.model[modelKey! as string] = convertVal?.(this.props[propKey]);
            }
        );
    }

    /**
     * 根节点（虚拟DOM）
     */
    public get $rootVNode(): Readonly<VNode.Root> | undefined {
        return this[PARSER_TEMPLATE_TARGET]?.root;
    }

    /**
     * 添加节点变更监听
     * @param ref  ref标记
     * @param callBack
     * @returns 销毁方法
     */
    public $watchNode(
        ref: string,
        callBack: (node: VNode.Node, type: NodeChangeType, property?: string) => void
    ): (() => void) | undefined {
        if (this[PARSER_TEMPLATE_TARGET]) {
            this[PARSER_TEMPLATE_TARGET]?.addNodeWatcher(ref, callBack);

            return () => {
                this[PARSER_TEMPLATE_TARGET]?.removeNodeWatcher(ref, callBack);
            };
        } else {
            logger.warn(LOGTAG, `该组件还未挂载，不可以进行节点观察监听`);
        }
    }

    /**
     * 观察值变更
     * @param express
     * @param callBack
     * @param forceCallBack 即使值相同也要强制触发callback
     * @returns [wathcer值， 销毁watcher]
     */
    public $watch(
        express: () => any,
        callBack: (nv?: any, ov?: any) => void,
        forceCallBack?: boolean
    ): [any, () => void] {
        let watcher = new Watcher(
            () => {
                if (this[IS_DESTROY]) {
                    //集中清理
                    for (let watcher of this[PRIVATE_WATCHERS]) {
                        watcher.destroy();
                    }
                    return BREAK_WATCH_UPDATE;
                }
                return express();
            },
            (newVal: any, oldVal: any) => {
                if (this[IS_DESTROY]) return;
                callBack(newVal, oldVal);
            },
            undefined,
            forceCallBack
        );

        this[PRIVATE_WATCHERS].push(watcher);

        return [
            watcher.value,
            () => {
                watcher.destroy();
                remove(this[PRIVATE_WATCHERS], watcher);
            }
        ];
    }

    /**
     * 事件注册
     * @param eventName
     * @param callBack
     */
    public $on(eventName: string, callBack: VNode.EventCallBack) {
        let callBacks = this[EVENT_DATA_KEY].get(eventName);

        if (callBacks === undefined) {
            callBacks = new Set();
            this[EVENT_DATA_KEY].set(eventName, callBacks);
        }

        if (callBacks?.has(callBack) === false) {
            callBacks.add(callBack);
        }
    }

    /**
     * 事件卸载
     * @param eventName
     * @param callBack
     */
    public $off(eventName: string, callBack?: VNode.EventCallBack) {
        let callBacks = this[EVENT_DATA_KEY].get(eventName);

        if (callBacks) {
            if (callBack) {
                callBacks.delete(callBack);
            } else {
                callBacks.clear();
            }
        }
    }
    /**
     * 触发事件
     * @param eventName 事件名称
     * @param param 参数
     * @param targetEvent event
     */
    public $trigger(eventName: string, param?: any, targetEvent?: VNode.Event<any>) {
        //销毁节点不做任何事件响应
        if (!this.$root) {
            return;
        }

        let e: VNode.Event<any> = {
            eventName,
            stopPropagation: targetEvent?.stopPropagation ?? (() => {}),
            preventDefault: targetEvent?.preventDefault ?? (() => {}),
            data: param,
            target: targetEvent?.target ?? this.$rootVNode,
            event: targetEvent?.event
        };
        //虚拟节点的事件传播，不是通过on进行传递，需要容器介质，保证不随着组件销毁
        if (this.$rootVNode && this.$rootVNode.parent && this.$rootVNode.parent instanceof VNode.Component) {
            if (this[PARSER_TEMPLATE_TARGET]?.render.triggerEvent(this.$rootVNode.parent, eventName, e) === false)
                return;
        }

        //实例事件响应
        let callBacks = this[EVENT_DATA_KEY].get(eventName);
        if (callBacks?.size) {
            [...callBacks].forEach((m) => {
                m(e);
            });
        }

        //全局补充
        let globalCallBacks = this[EVENT_DATA_KEY].get("*");
        if (globalCallBacks?.size) {
            [...globalCallBacks].forEach((m) => {
                m(e);
            });
        }
    }

    /**
     * 主动渲染（仅渲染，一般适用于模板区域的热更新使用/或动态装载等复杂场景）
     * @param newTemplate 可指定新的模板，否则按照原模板
     * @param keepalive 渲染新模板时，是否要保留之前的存活组件（高级用法）
     * @returns
     */
    public $render(newTemplate?: TemplateType, keepalive?: boolean) {
        //之所以 将template放在前置，而不是判断root之后，是为了keepalive组件的热更新
        newTemplate ??= this.template;
        if (typeof newTemplate === "function") {
            this.template = newTemplate(RENDER_HANDLER);
        } else {
            this.template = newTemplate;
        }

        if (!this.$root) {
            //未挂在/已销毁/已压栈，不做rerender
            return;
        }

        //执行一次render，则初始化一次template
        this.template ??= [];

        this[PARSER_TEMPLATE_TARGET]?.reSetAsts(this.template, keepalive);

        this[PARSER_TEMPLATE_TARGET] ??= new ParserTemplate(this.template, this, this.$root);

        this[PARSER_TEMPLATE_TARGET].parser();

        if (this.$root) {
            this[PARSER_TEMPLATE_TARGET].mount(this.$root);
        }
    }

    /**
     * 生命周期函数（完成初始化）
     */
    protected created(): void | Promise<void> {}

    /**
     * 生命周期函数（完成挂载）
     */
    protected mounted(): void | Promise<void> {}

    /**
     * 生命周期函数（销毁前）
     */
    protected beforeDestroy() {}

    /**
     * 睡眠时，在启用keepalive属性时才会触发该周期
     */
    protected sleeped() {}

    /**
     * 唤醒时，在启用keepalive属性时才会触发该周期
     */
    protected wakeup() {}

    /**
     * 生命周期函数（销毁后）
     */
    protected destroyed() {}
}

//#region 全局组件注册
//全局组件注册
const globalComponents: Record<string, ComponentConstructor | ImportComponentConstructor> = {};

/**
 * 注册全局组件
 * @param componentsOrName 组件名/列表
 * @param component 组件
 */
export function registerGlobalComponent(
    componentsOrName: Record<string, ComponentConstructor | ImportComponentConstructor> | string,
    component?: ComponentConstructor | ImportComponentConstructor
): void {
    if (typeof componentsOrName === "string") {
        if (component) {
            globalComponents[componentsOrName] = component;
        }
    } else {
        for (let name in componentsOrName) {
            globalComponents[name] = componentsOrName[name];
        }
    }
}

/**
 * 根据注册key获取组件
 * @param name 组件名称
 * @returns 组件
 */
export function getGlobalComponent(key: string): ComponentConstructor | ImportComponentConstructor | undefined {
    return globalComponents[key];
}

//#endregion

//#region 工具方法
/**
 * 睡眠事件穿透广播
 * @param vnode
 */
function sleepNotify(vnode: VNode.Node) {
    vnode.childrens?.forEach((m) => {
        if (m instanceof VNode.Component) {
            m.component?.sleeped();
        }
        sleepNotify(m);
    });
}

/**
 * 唤醒事件穿透广播
 * @param vnode
 */
function weakupNotify(vnode: VNode.Node) {
    vnode.childrens?.forEach((m) => {
        if (m instanceof VNode.Component) {
            m.component?.wakeup();
        }
        weakupNotify(m);
    });
}
//#endregion

//#region 默认集成组件
/**
 * 动态组件容器
 */
export class ComponentContainer extends Component<{
    [key: string]: any;
    name: string;
    props: object;
    "transition-name": string;
}> {
    template = [];

    private cache: Map<string, IComponent> = new Map();

    async mounted() {
        this.$watch(
            () => this.props.name,
            async (componentName) => {
                //先做清理
                this.$render([], true);

                //等待参数同步
                await Promise.resolve();

                //当name值变更时，需要等待参数刷新后一同更新
                this.$root && this.loadComponent(componentName);
            }
        );

        await this.loadComponent(this.props.name);
    }
    private propsVaule: any;

    created() {
        this.initProps();
    }

    initProps() {
        let propsData: Record<string, any> = {};

        if (!this.props.props) {
            Object.keys(this.props).forEach((p) => {
                //过滤
                if (this.filterProps(p) === false) return;

                propsData[p] = this.props[p];

                //单项数据同步
                this.$watch(
                    () => this.props[p],
                    () => {
                        this.propsVaule[p] = this.props[p];
                    }
                );
            });

            this.propsVaule = observer(propsData);
        }
    }

    filterProps(p: string) {
        //过滤
        if (typeof p !== "string") return false;

        let pName = toLowerCase(p);
        if (pName === "transition-name" || pName === "name" || pName === "keep-alive" || pName === "ref") return false;
    }

    async loadComponent(componentName?: string) {
        if (!componentName) {
            this.$render([], this.isKeepAlive);
            return;
        }

        let cacheComponent: IComponent;

        if (this.isKeepAlive) {
            let cacheComponent = this.cache.get(componentName);
            if (cacheComponent) {
                this.$render(
                    [createComponent(cacheComponent, { "transition-name": this.props["transition-name"] })],
                    true
                );
                return;
            }
        }

        let hostComponents = this.$rootVNode?.parent?.[VNode.PARSERKEY]?.ob.components;

        let component = hostComponents?.[componentName];

        if (component === undefined) {
            component = getGlobalComponent(componentName);
        }

        if (component) {
            if (!(JOKER_COMPONENT_TAG in component)) {
                component = (await component()).default;
            }

            cacheComponent = new component(this.props.props || this.propsVaule, this.$sections, this.isKeepAlive);

            //事件向上穿透广播
            (<Component>cacheComponent).$on("*", (e) => {
                this.$trigger(e.eventName, e.data, e);
            });

            this.isKeepAlive && this.cache.set(componentName, cacheComponent);

            this.$render(
                [createComponent(cacheComponent, { "transition-name": this.props["transition-name"] })],
                this.isKeepAlive
            );
        } else {
            logger.warn("component", `未找到${componentName}的组件`);
        }
    }

    beforeDestroy() {
        this.removeCache();
    }

    public removeCache(componentName?: string) {
        if (componentName) {
            let cacheComponent = this.cache.get(componentName);
            this.cache.delete(componentName);
            if (cacheComponent) {
                cacheComponent.$destroy(true);
            }
        } else {
            this.cache.forEach((value) => {
                value.$destroy(true);
            });

            this.cache.clear();
        }
    }
}

/**
 * 虚拟模板容器，用于进行归组，作为组件配置属性
 */
export class Template extends Component {
    template = function () {
        return [createCommand("RenderSection")];
    };
    async mounted() {
        await this.$nextUpdatedRender();
    }
}

registerGlobalComponent({
    template: Template,
    component: ComponentContainer
});

//#endregion
