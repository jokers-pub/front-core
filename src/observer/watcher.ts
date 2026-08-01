import { isEqual, isObject, logger } from "@joker.front/shared";
import { Dep } from "./dep";
const LOGTAG = "Data Observation";

export const BREAK_WATCH_UPDATE = Symbol.for("JOKER_BREAK_WATCH_UPDATE");
/**
 * 点表达式缓存，避免重复分割和创建getter
 */
const getterCache = new Map<string, Function>();

/**
 * Convert value expression to get method
 * @param exp Expression string
 * @returns Getter function or undefined on error
 */
function transformGetter(exp: string): Function | undefined {
    // Filter invalid properties
    if (/[^\w.$]/.test(exp)) {
        return;
    }

    let getter = getterCache.get(exp);
    if (getter) return getter;

    const exps = exp.split(".");
    const len = exps.length;

    getter = function (data: object) {
        let result: any = data;
        for (let i = 0; i < len; i++) {
            if (!result) return result;
            result = result[exps[i]];
        }
        return result;
    };

    getterCache.set(exp, getter);
    return getter;
}

/**
 * Observer
 *
 * Manages object observation, collects dependency relationships,
 * and triggers callback responses when values change
 */
export class Watcher<T extends object = any> {
    private getter!: Function;

    public value: any;

    public isDestroy = false;

    public updating = false;
    /**
     * Runtime relationship collection
     *
     * Main purpose: filter duplicates at runtime and collect "valid" Dep relationships
     * Each Dep corresponds to an object, and object keys do not repeat
     * 用Set存储key，O(1)判断代替O(n) includes
     */
    private runRelations: Map<Dep, Set<string | symbol | number>> = new Map();

    /**
     * Actual dependency relations
     * 用Set存储key，O(1)判断代替O(n) includes
     */
    public relations: Map<Dep, Set<string | symbol | number>> = new Map();

    /**
     * @param ob Data source to observe (object or getter function)
     * @param updateCallBack Callback function for value changes
     * @param expOrFn Expression string or value extraction function
     * @param forceCallBack Force callback even if value appears unchanged
     */
    constructor(
        private ob: T | (() => T),
        private updateCallBack: Function,
        expOrFn?: string | ((obj: T) => any | void) | Function,
        private forceCallBack?: boolean
    ) {
        if (ob === undefined) {
            throw new Error("Cannot observe changes on undefined");
        }

        if (expOrFn === undefined) {
            this.getter = (obj: any) => obj;
        } else if (typeof expOrFn === "function") {
            this.getter = expOrFn;
        } else {
            const getFunc = transformGetter(expOrFn);

            if (getFunc === undefined) {
                throw new Error(
                    `${expOrFn} failed to parse. Unable to interpret the expression. ` +
                        `Please check the expOrFn parameter or use the function mode instead.`
                );
            }
            this.getter = getFunc;
        }

        if (this.getter === undefined) {
            logger.error(LOGTAG, "Failed to create getter", arguments);
        }

        this.value = this.getValue();
    }

    public getValue() {
        // Skip if watcher is destroyed (avoids upward listening broadcasts)
        if (this.isDestroy || this.getter === undefined) {
            return;
        }

        Dep.target = this;

        const targetData = typeof this.ob === "function" ? this.ob() : this.ob;
        let value;
        try {
            value = this.getter.call(targetData, targetData);
        } catch (e) {
            logger.error(LOGTAG, "Failed to retrieve value. Executed method: " + this.getter.toString());
            throw e;
        } finally {
            Dep.target = undefined;
        }

        this.clearnDeps();
        return value;
    }

    /**
     * Add Dep relationship
     * @param dep Dependency instance
     * @param key Observed property key
     */
    public addDep(dep: Dep, key: string | symbol | number) {
        if (this.isDestroy) return;

        let runItem = this.runRelations.get(dep);
        if (!runItem) {
            runItem = new Set();
            this.runRelations.set(dep, runItem);
        }
        if (runItem.has(key)) return;

        runItem.add(key);

        const depItem = this.relations.get(dep);
        if (!depItem?.has(key)) {
            dep.addWatcher(key, this);
        }
    }

    /**
     * Update observed value and trigger response
     */
    public update() {
        // 快速路径：已销毁/更新中直接返回
        if (this.isDestroy || this.updating) return;

        this.updating = true;
        try {
            const newVal = this.getValue();

            if (newVal === BREAK_WATCH_UPDATE) return;

            const oldVal = this.value;

            // 快速路径：值完全相同且不需要强制回调，直接返回
            if (newVal === oldVal && !this.forceCallBack && !isObject(newVal)) {
                return;
            }

            this.value = newVal;

            // Skip response for reference-unequal but value-equal objects
            // (does not affect future changes)
            const isEqualValue = newVal !== oldVal && isEqual(newVal, oldVal, true);
            if (isEqualValue && !this.forceCallBack) {
                return;
            }

            this.updateCallBack(newVal, oldVal, isEqualValue, this);
        } finally {
            this.updating = false;
        }
    }

    public destroy() {
        if (this.isDestroy) return;

        this.isDestroy = true;

        this.relations.forEach((keys, dep) => {
            keys.forEach((key) => dep.removeWatcher(key, this));
        });

        this.relations.clear();
        this.runRelations.clear();

        this.ob = <any>undefined;
        this.value = undefined;
        this.getter = <any>undefined;
        this.updateCallBack = <any>undefined;
    }

    private clearnDeps() {
        // 清理旧的不再使用的依赖
        this.relations.forEach((keys, dep) => {
            const runItem = this.runRelations.get(dep);
            if (runItem) {
                // 移除本次运行没有访问到的key
                keys.forEach((key) => {
                    if (!runItem.has(key)) {
                        dep.removeWatcher(key, this);
                    }
                });
            } else {
                // 整个dep都没访问到，移除所有key
                keys.forEach((key) => dep.removeWatcher(key, this));
            }
        });

        // 交换relations和runRelations，避免创建新Map
        const temp = this.relations;
        this.relations = this.runRelations;
        this.runRelations = temp;
        this.runRelations.clear();
    }
}
