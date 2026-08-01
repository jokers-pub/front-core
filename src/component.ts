import { AST, IComponent, RENDER_HANDLER, createCommand, createComponent } from "@joker.front/ast";
import { logger, remove, toLowerCase } from "@joker.front/shared";
import { observer } from "./observer";
import { BREAK_WATCH_UPDATE, Watcher } from "./observer/watcher";
import { NodeChangeType, ParserTemplate } from "./parser";
import { VNode } from "./parser/vnode";
import { PropType, getPropValue } from "./props";
import { isGetterProperty } from "./utils";

const LOGTAG = "Component";
const PROPS_DATA_KEY = Symbol.for("JOKER_PROPS_DATA_KEY");
const PROPS_DATA_PROXY = Symbol.for("JOKER_PROPS_DATA_PROXY");
const PROPS_CACHE_KEY = Symbol.for("JOKER_PROPS_CACHE_KEY");
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

const componentFunctionPropertyNames = new Set([
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
]);

/**
 * Joker component
 */
export class Component<T extends DefaultKeyVal = {}> implements IComponent {
    static [JOKER_COMPONENT_TAG] = true;

    /**
     * scopeId for css scoping
     */
    public [SCOPE_ID]?: string;

    /**
     * Observable data (with hijacking observation capability)
     */
    public model: DefaultKeyVal = {};

    /**
     * Render template
     */
    public template?: TemplateType;

    /**
     * Mount root
     */
    public $root?: VNode.Component & HTMLElement;

    /**
     * Whether it is slept
     */
    public isSleeped: boolean = false;
    /**
     * Available declared components
     */
    public components: Record<string, ComponentConstructor | ImportComponentConstructor> = {};

    /**
     * Props auxiliary constraints
     * @example { name:"default value", age:Number }
     * Can configure default values or constraints, type reference PropType
     */
    public propsOption?: Partial<Record<keyof T, PropType | any>>;

    private [PROPS_DATA_KEY]: Readonly<Record<string, any>> = {};

    private [PARSER_TEMPLATE_TARGET]?: ParserTemplate;

    private [PROPS_DATA_PROXY]?: Record<string, any>;

    private [PROPS_CACHE_KEY]?: Map<string | symbol, { raw: any; value: any }>;

    private [PRIVATE_WATCHERS] = new Set<Watcher<any>>();

    private [EVENT_DATA_KEY]: Map<string, Set<VNode.EventCallBack>> = new Map();

    private [IS_DESTROY] = false;

    // Method conversion flag
    private [TRANSFORM_FUNCTION_FLAG] = false;
    /**
     * @param propData prop parameters
     * @param sections Render partial area
     * @param isKeepAlive Whether to keep alive, when enabled, only the UI part will be destroyed during destroy, and the data will not be destroyed until destroy(true) is used
     */
    constructor(
        propData?: T,
        public $sections: Record<string, SectionType> = {},
        public readonly isKeepAlive?: boolean
    ) {
        this[PROPS_DATA_KEY] = propData || {};
    }

    /**
     * Actively declare accepted parameters
     * @returns
     */
    public get props(): Readonly<T> {
        if (this[PROPS_DATA_PROXY] === undefined) {
            const self = this;
            // 缓存存储在组件实例上，便于销毁时显式清理，避免内存泄漏
            this[PROPS_CACHE_KEY] = new Map<string | symbol, { raw: any; value: any }>();

            this[PROPS_DATA_PROXY] = new Proxy(self[PROPS_DATA_KEY], {
                get(target, p: string | symbol) {
                    // Symbol属性直接返回，不做props处理（内置Symbol等）
                    if (typeof p === "symbol") {
                        //@ts-ignore
                        return self[PROPS_DATA_KEY][p];
                    }

                    // 始终使用最新的PROPS_DATA_KEY，避免propsData被替换后访问旧值
                    const currentPropsData = self[PROPS_DATA_KEY];
                    const propsOption = self.propsOption;

                    // 快速路径：无props配置（80%+业务场景），直接返回原始值，跳过所有缓存和转换逻辑
                    if (propsOption === undefined) {
                        //@ts-ignore
                        if (p in currentPropsData) return currentPropsData[p];
                        // 自动转换kebab-case到camelCase
                        return currentPropsData[toLowerCase(p)];
                    }

                    const propsCache = self[PROPS_CACHE_KEY]!;

                    // 统一获取原始值（这一步会触发响应式依赖收集）
                    let rawVal: any;
                    //@ts-ignore
                    if (p in currentPropsData) {
                        //@ts-ignore
                        rawVal = currentPropsData[p];
                    } else {
                        rawVal = currentPropsData[toLowerCase(p)];
                    }

                    // 缓存命中且原始值未变化，直接返回缓存结果
                    const cached = propsCache.get(p);
                    if (cached && cached.raw === rawVal) {
                        return cached.value;
                    }

                    // 首次访问/值变化时才调用getPropValue计算
                    const value = getPropValue(currentPropsData, p, propsOption);
                    propsCache.set(p, { raw: rawVal, value });
                    return value;
                },
                set() {
                    throw new Error(
                        "props parameters are not allowed to be changed, only one-way data transfer is allowed"
                    );
                }
            });
        }

        return this[PROPS_DATA_PROXY] as T;
    }

    /**
     * Mount
     * @param root
     */
    public $mount(root: any | VNode.Component): this {
        if (this[TRANSFORM_FUNCTION_FLAG] === false) {
            const childMethods: string[] = [];
            let currentObj = Object.getPrototypeOf(this);
            while (currentObj !== null && currentObj !== Object.prototype) {
                const props = Object.getOwnPropertyNames(currentObj);
                for (let i = 0, len = props.length; i < len; i++) {
                    const property = props[i];
                    if (
                        // Exclude constructor and internal functions
                        !componentFunctionPropertyNames.has(property) &&
                        // Exclude get properties
                        !isGetterProperty(currentObj, property) &&
                        typeof currentObj[property] === "function" &&
                        // Exclude class
                        !currentObj[property].prototype?.hasOwnProperty("constructor")
                    ) {
                        childMethods.push(property);
                    }
                }
                currentObj = Object.getPrototypeOf(currentObj);
            }

            // Change function this pointer
            for (let i = 0, len = childMethods.length; i < len; i++) {
                const name = childMethods[i];
                this[name as keyof this] = (this[name as keyof this] as Function).bind(this);
            }
            this[TRANSFORM_FUNCTION_FLAG] = true;
        }

        this.$root = root;

        // Wake up from sleep
        if (this.isKeepAlive && this.isSleeped) {
            this.isSleeped = false;

            if (this[PARSER_TEMPLATE_TARGET] && this.$root) {
                this[PARSER_TEMPLATE_TARGET].mount(this.$root);
            } else {
                logger.error(
                    LOGTAG,
                    "When attempting to wake up the current component, it was found that the rendering handler has been destroyed. The wake-up operation cannot proceed.",
                    [this, this.$root]
                );
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

            // If there is a template, execute render, otherwise do not process
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

        // Collect asynchronous renders at this moment (including subsets)
        let promiseQueue: Array<Promise<any>> = [...(this[PARSER_TEMPLATE_TARGET]?.promiseQueue || [])];
        let childrens: any = this.$rootVNode?.find((n) => n instanceof VNode.Component);
        childrens?.forEach((n: any) => {
            n?.component && promiseQueue.push(...(n.component[PARSER_TEMPLATE_TARGET]?.promiseQueue || []));
        });
        if (promiseQueue.length) {
            return Promise.all(promiseQueue).finally(() => {
                if (this[IS_DESTROY]) return;
                callBack?.();
            });
        } else {
            if (this[IS_DESTROY]) return;
            callBack?.();
        }
    }

    /**
     * Node animation, only supports element and component nodes
     */
    public $nodeTransition(
        nodeOrRef: string | VNode.Node,
        mode: "enter" | "leave",
        name?: string,
        callBack?: Function,
        type?: "transition" | "animation"
    ): void {
        if (this.$root && !this[IS_DESTROY]) {
            if (typeof nodeOrRef === "string") {
                let vnode = this.$getRef(nodeOrRef);

                if (vnode) {
                    nodeOrRef = vnode;
                } else {
                    logger.warn(LOGTAG, `Node with ref=${nodeOrRef} not found when executing node animation`);
                    return;
                }
            }
            this[PARSER_TEMPLATE_TARGET]?.nodeTransition(nodeOrRef, mode, name, callBack, type);
        }
    }

    /**
     * Destroy
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

        //#region Clear listeners within the component and listeners within template compilation
        this[PRIVATE_WATCHERS].forEach((watcher) => watcher.destroy());
        this[PRIVATE_WATCHERS].clear();

        //先清除响应式，再执行销毁前的周期
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
        // 显式清空props缓存，彻底释放内存，避免内存泄漏
        this[PROPS_CACHE_KEY]?.clear();
        this[PROPS_CACHE_KEY] = undefined;

        this[PROPS_DATA_KEY] = {};

        this.destroyed();
    }

    /**
     * VNode ref index set
     */
    public get $refs(): Readonly<Record<string, Array<VNode.Node>>> {
        return this[PARSER_TEMPLATE_TARGET]?.refs || {};
    }

    /**
     * Get a single VNode by ref
     */
    public $getRef<T extends VNode.Node = VNode.Element & VNode.Component>(ref: string): T | undefined {
        return this.$refs[ref]?.[0] as T;
    }

    /**
     * Get the VNode collection with the same ref
     */
    public $getRefs<T extends VNode.Node = VNode.Element & VNode.Component>(ref: string): Array<T> | undefined {
        return this.$refs[ref] as T[];
    }

    /**
     * Unidirectionally synchronize prop values and listen for changes to resynchronize
     * @param propKey The props key to observe and synchronize
     * @param modelKey The model key to assign, if not passed, assign by prop key
     * @param convertVal Value conversion method
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
        // Synchronize first and then observe
        this.model[modelKey] = convertVal(this.props[propKey]);

        this.$watch(
            () => this.props[propKey],
            () => {
                this.model[modelKey! as string] = convertVal?.(this.props[propKey]);
            }
        );
    }

    /**
     * Root node (virtual DOM)
     */
    public get $rootVNode(): Readonly<VNode.Root> | undefined {
        return this[PARSER_TEMPLATE_TARGET]?.root;
    }

    /**
     * Add node change listening
     * @param ref ref mark
     * @param callBack
     * @returns Destroy method
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
            logger.warn(LOGTAG, "Component is not yet mounted. Node observation and monitoring cannot be performed.");
        }
    }

    /**
     * Observe value changes
     * @param express
     * @param callBack
     * @param forceCallBack Force trigger callback even if the value is the same
     * @returns [wathcer value, destroy watcher]
     */
    public $watch(
        express: () => any,
        callBack: (nv?: any, ov?: any) => void,
        forceCallBack?: boolean
    ): [any, () => void] {
        const self = this;
        let watcher = new Watcher(
            () => {
                if (self[IS_DESTROY]) {
                    return BREAK_WATCH_UPDATE;
                }
                return express();
            },
            (newVal: any, oldVal: any) => {
                if (self[IS_DESTROY]) return;
                callBack(newVal, oldVal);
            },
            undefined,
            forceCallBack
        );

        this[PRIVATE_WATCHERS].add(watcher);

        return [
            watcher.value,
            () => {
                watcher.destroy();
                self[PRIVATE_WATCHERS].delete(watcher);
            }
        ];
    }

    /**
     * Event registration
     * @param eventName
     * @param callBack
     */
    public $on(eventName: string, callBack: VNode.EventCallBack) {
        let callBacks = this[EVENT_DATA_KEY].get(eventName);
        if (callBacks === undefined) {
            callBacks = new Set();
            this[EVENT_DATA_KEY].set(eventName, callBacks);
        }
        // Set.add本身会自动去重，不需要额外判断
        callBacks.add(callBack);
    }

    /**
     * Event unload
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
     * Event Listeners
     */
    public get $listeners() {
        const result: Record<string, VNode.EventCallBack<any>[]> = {};
        const eventMap = this[EVENT_DATA_KEY];

        eventMap.forEach((callBacks, eventName) => {
            result[eventName] = Array.from(callBacks);
        });

        const root = this.$root;
        if (root && root instanceof VNode.Component) {
            const events = root.events;
            for (let i = 0, len = events.length; i < len; i++) {
                const [eventName, handler] = events[i];
                const list = result[eventName] || (result[eventName] = []);
                list.push(handler.callBack);
            }
        }

        return result;
    }
    /**
     * Trigger event
     * @param eventName Event name
     * @param param Parameters
     * @param targetEvent event
     */
    public $trigger(eventName: string, param?: any, targetEvent?: VNode.Event<any>) {
        // Destroyed nodes do not respond to any events
        if (!this.$root) {
            return;
        }

        let e: VNode.Event<any> = {
            eventName,
            stopPropagation: targetEvent?.stopPropagation ?? (() => {}),
            preventDefault: targetEvent?.preventDefault ?? (() => {}),
            data: param,
            //@ts-ignore
            target: targetEvent?.target ?? this.$rootVNode,
            event: targetEvent?.event
        };
        // Event propagation of virtual nodes is not passed through on, but requires a container medium to ensure that it is not destroyed with the component
        if (this.$rootVNode && this.$rootVNode.parent && this.$rootVNode.parent instanceof VNode.Component) {
            if (this[PARSER_TEMPLATE_TARGET]?.render.triggerEvent(this.$rootVNode.parent, eventName, e) === false)
                return;
        }

        // Instance event response
        let callBacks = this[EVENT_DATA_KEY].get(eventName);
        if (callBacks?.size) {
            // 复制数组避免遍历过程中回调修改集合
            const copy = Array.from(callBacks);
            for (let i = 0, len = copy.length; i < len; i++) {
                copy[i](e);
            }
        }

        // Global supplement
        let globalCallBacks = this[EVENT_DATA_KEY].get("*");
        if (globalCallBacks?.size) {
            const copy = Array.from(globalCallBacks);
            for (let i = 0, len = copy.length; i < len; i++) {
                copy[i](e);
            }
        }
    }

    /**
     * Active rendering (only rendering, generally suitable for complex scenarios such as hot updates of template areas/dynamic loading, etc.)
     * @param newTemplate Can specify a new template, otherwise use the original template
     * @param keepalive When rendering a new template, whether to retain the previous live components (advanced usage)
     * @returns
     */
    public $render(newTemplate?: TemplateType, keepalive?: boolean) {
        // The reason for placing the template in the front instead of after judging the root is for hot updates of keepalive components
        newTemplate ??= this.template;
        if (typeof newTemplate === "function") {
            this.template = newTemplate(RENDER_HANDLER);
        } else {
            this.template = newTemplate;
        }

        if (!this.$root) {
            // Do not rerender if not mounted/destroyed/pushed onto the stack
            return;
        }

        // Execute a render, then initialize a template
        this.template ??= [];

        this[PARSER_TEMPLATE_TARGET]?.reSetAsts(this.template, keepalive);

        this[PARSER_TEMPLATE_TARGET] ??= new ParserTemplate(this.template, this, this.$root);

        this[PARSER_TEMPLATE_TARGET].parser();

        if (this.$root) {
            this[PARSER_TEMPLATE_TARGET].mount(this.$root);
        }
    }

    /**
     * Lifecycle function (initialization completed)
     */
    protected created(): void | Promise<void> {}

    /**
     * Lifecycle function (mounting completed)
     */
    protected mounted(): void | Promise<void> {}

    /**
     * Lifecycle function (before destruction)
     */
    protected beforeDestroy() {}

    /**
     * When sleeping, this cycle is only triggered when the keepalive attribute is enabled
     */
    protected sleeped() {}

    /**
     * When waking up, this cycle is only triggered when the keepalive attribute is enabled
     */
    protected wakeup() {}

    /**
     * Lifecycle function (after destruction)
     */
    protected destroyed() {}
}

//#region Global component registration
// Global component registration
const globalComponents: Record<string, ComponentConstructor | ImportComponentConstructor> = {};

/**
 * Register global components
 * @param componentsOrName Component name/list
 * @param component Component
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
 * Get component by registration key
 * @param name Component name
 * @returns Component
 */
export function getGlobalComponent(key: string): ComponentConstructor | ImportComponentConstructor | undefined {
    return globalComponents[key];
}

//#endregion

//#region Tool methods
/**
 * Sleep event penetration broadcast
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
 * Wake up event penetration broadcast
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

//#region Default integrated components
/**
 * Dynamic component container
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
                // Clean up first
                this.$render([], true);

                // Wait for parameter synchronization
                await Promise.resolve();

                // When the name value changes, wait for the parameter to refresh and update together
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
                // Filter
                if (this.filterProps(p) === false) return;

                propsData[p] = this.props[p];

                // Single-directional data synchronization
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
        // Filter
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

            // Event upward penetration broadcast
            (<Component>cacheComponent).$on("*", (e) => {
                this.$trigger(e.eventName, e.data, e);
            });

            this.isKeepAlive && this.cache.set(componentName, cacheComponent);

            this.$render(
                [createComponent(cacheComponent, { "transition-name": this.props["transition-name"] })],
                this.isKeepAlive
            );
        } else {
            logger.warn("component", `Component ${componentName} not found`);
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
 * Virtual template container, used for grouping, as a component configuration attribute
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
