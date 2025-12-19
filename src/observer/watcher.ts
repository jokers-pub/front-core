import { isEqual, isObject, logger } from "@joker.front/shared";
import { Dep } from "./dep";
const LOGTAG = "Data Observation";

export const BREAK_WATCH_UPDATE = Symbol.for("JOKER_BREAK_WATCH_UPDATE");
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

    const exps = exp.split(".");

    return function (data: object) {
        let result: any = data;
        exps.forEach((key) => {
            if (!result) {
                return;
            }

            result = result[key];
        });

        return result;
    };
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
     */
    private runRelations: Map<Dep, Array<string | symbol | number>> = new Map();

    /**
     * Actual dependency relations
     */
    public relations: Map<Dep, Array<string | symbol | number>> = new Map();

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
        if (this.getter === undefined) {
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
        }
        Dep.target = undefined;

        this.clearnDeps();
        return value;
    }

    /**
     * Add Dep relationship
     * @param dep Dependency instance
     * @param key Observed property key
     */
    public addDep(dep: Dep, key: string | symbol | number) {
        let runItem = this.runRelations.get(dep);

        if (runItem === undefined || !runItem.includes(key)) {
            runItem = runItem || [];
            runItem.push(key);

            this.runRelations.set(dep, runItem);

            const depItem = this.relations.get(dep);
            // Add if relationship not previously stored
            // Cleanup will handle relation conversion later
            if (depItem === undefined || !depItem.includes(key)) {
                dep.addWatcher(key, this);
            }
        }
    }

    /**
     * Update observed value and trigger response
     */
    public update() {
        // Prevent circular calls during notification
        if (this.updating) return;

        const newVal = this.getValue();

        if (newVal === BREAK_WATCH_UPDATE) return;

        const oldVal = this.value;

        // Force callback | value changed | value is object (reference type)
        if (this.forceCallBack || newVal !== oldVal || isObject(newVal)) {
            this.value = newVal;

            // Skip response for reference-unequal but value-equal objects
            // (does not affect future changes)
            const isEqualValue = newVal !== oldVal && isEqual(newVal, oldVal, true);
            if (isEqualValue && !this.forceCallBack) {
                return;
            }
            this.updating = true;
            try {
                this.updateCallBack(newVal, oldVal, isEqualValue, this);
            } catch (e) {
                throw e;
            } finally {
                this.updating = false;
            }
        }
    }

    public destroy() {
        this.relations.forEach((keys, dep) => {
            for (const key of keys) {
                dep.removeWatcher(key, this);
            }
        });

        this.isDestroy = true;

        this.relations.clear();
        this.runRelations.clear();

        this.ob = <any>undefined;
        this.value = undefined;
        this.getter = <any>undefined;
        this.updateCallBack = <any>undefined;
    }

    private clearnDeps() {
        this.relations.forEach((keys, dep) => {
            const runItem = this.runRelations.get(dep);
            for (const key of keys) {
                if (runItem) {
                    if (!runItem.includes(key)) {
                        dep.removeWatcher(key, this);
                    }
                } else {
                    // Remove all dependencies for this key
                    dep.removeWatcher(key, this);
                }
            }
        });

        this.relations.clear();
        this.relations = this.runRelations;

        this.runRelations = new Map();
    }
}
