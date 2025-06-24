import {
    defineProperty,
    deepClone,
    hasOwnProperty,
    hasProperty,
    isObject,
    isPlainObject,
    logger
} from "@joker.front/shared";
import { Dep, notifyGroupDeps } from "./dep";
import { Component, JOKER_COMPONENT_TAG, JOKER_VNODE_TAG, ParserTemplate, Watcher } from "../index";

/**
 * Symbol key for storing the Dep instance of a proxied object
 */
export const OBJECTPROXY_DEPID = Symbol.for("__JOKER_OBJECT_PROXY_DEP_ID__");

const OBJECTPROXY_DATA_KEY = Symbol.for("__JOKER_OBJECT_PROXY_DATA_KEY__");

/**
 * Symbol key for virtual dependency level tracking in deep observation
 */
const OBJECTPROXY_DEPLEVE_ID = Symbol.for("__JOKER_OBJECTPROXY_DEPLEVE_ID__");

/**
 * Check if an object can be proxied for observation
 * @param data Object to check
 * @returns True if the object can be proxied
 */
function checkEnableProxy(data: any): boolean {
    try {
        return (
            data !== undefined &&
            data !== null &&
            isObject(data) &&
            data !== window.parent &&
            data instanceof Window === false &&
            data instanceof Watcher === false &&
            data instanceof Component === false &&
            data instanceof ParserTemplate === false &&
            (Array.isArray(data) || isPlainObject(data) || data instanceof Set || data instanceof Map) &&
            // Not frozen
            !Object.isFrozen(data) &&
            !(data instanceof Element) &&
            !(JOKER_VNODE_TAG in data) &&
            !(JOKER_SHALLOW_OBSERVER_TAG in data) &&
            !(JOKER_COMPONENT_TAG in data)
        );
    } catch {
        return false;
    }
}

/**
 * Create a reactive proxy for an object
 * @param data Object to proxy
 * @returns Proxied object
 */
function proxyData<T extends object | Set<any>>(data: T): T {
    let proxyDepTarget = getProxyDep(data);

    // Return existing proxy if already observed
    if (proxyDepTarget) {
        return data;
    }

    // Check for existing proxy data key
    if (data && data.hasOwnProperty(OBJECTPROXY_DATA_KEY)) {
        let readiedData = Reflect.get(data, OBJECTPROXY_DATA_KEY);
        if (readiedData) {
            return readiedData as T;
        }
    }

    let dep = new Dep();

    // Flag to skip notifications during initial setup
    let resetData = true;

    let result = new Proxy(data, {
        get(target: any, key: string | symbol, receiver: any) {
            if (target instanceof Set || target instanceof Map) {
                if (key === "add") {
                    let result = Reflect.get(target, key) as Function;
                    return (value: any) => {
                        if (checkEnableProxy(value)) {
                            // Observe objects before adding
                            value = observer(value);
                        }

                        let callResult = result.call(target, value);
                        notifyDep(dep, "size");
                        notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
                        return callResult;
                    };
                } else if (key === "set") {
                    let result = Reflect.get(target, key) as Function;
                    return (key: any, value: any) => {
                        if (checkEnableProxy(value)) {
                            // Observe objects before setting
                            value = observer(value);
                        }

                        let callResult = result.call(target, key, value);
                        notifyDep(dep, "size");
                        notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
                        return callResult;
                    };
                } else if (key === "delete" || key === "clear") {
                    let result = Reflect.get(target, key) as Function;
                    return (value: any) => {
                        let callResult = result.call(target, value);

                        if (key === "clear" || callResult) {
                            notifyDep(dep, "size");
                            notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
                        }
                        return callResult;
                    };
                }
                let result = Reflect.get(target, key);
                if (typeof result === "function") {
                    return result.bind(target);
                }
            }

            // Skip internal data key
            if (key === OBJECTPROXY_DATA_KEY) {
                return undefined;
            }

            // Return the Dep instance for this proxy
            if (key === OBJECTPROXY_DEPID) {
                return dep;
            }

            // Skip virtual dependency key
            if (key === OBJECTPROXY_DEPLEVE_ID) {
                return undefined;
            }

            let result = Reflect.get(target, key);

            if (key === Symbol.toStringTag) {
                return result;
            }

            // Skip non-existent properties (except length/size)
            if (hasProperty(target, key) === false && key !== "length" && key !== "size") {
                return result;
            }

            // Collect dependency for this property
            dep.depend(key);

            // Track nested object dependencies
            if (checkEnableProxy(result)) {
                getProxyDep(result)?.depend(OBJECTPROXY_DEPLEVE_ID);
            }

            return result;
        },
        set(target: object, key: string | symbol, value: any): boolean {
            if (resetData) {
                Reflect.set(target, key, value);
                return true;
            }
            if (checkEnableProxy(value)) {
                // Observe new object values
                value = observer(value);
            }
            let isNewProperty = hasOwnProperty(target, key) === false;

            let isChange = Reflect.get(target, key) !== value;

            Reflect.set(target, key, value);

            // Notify on value changes (or length changes for arrays)
            if (isChange || (key === "length" && Array.isArray(target))) notifyDep(dep, key);

            // Notify on array length changes or new object properties
            if (Array.isArray(target)) {
                key === "length" && notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
            } else if (isNewProperty) {
                notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
            }

            return true;
        },
        deleteProperty(target: object, key: string | symbol): boolean {
            Reflect.deleteProperty(target, key);

            // Notify on property deletion for non-arrays
            if (Array.isArray(target) === false) {
                notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
            }

            return true;
        }
    });

    // Attach proxy reference to original object
    defineProperty(data, OBJECTPROXY_DATA_KEY, result, false);

    // Recursively observe existing properties
    for (let key in data) {
        let itemData = data[key];

        // Observe nested objects that aren't already observed
        if (checkEnableProxy(itemData) && !getProxyDep(itemData)) {
            //@ts-ignore
            result[key] = proxyData(data[key]);
        }
    }
    resetData = false;

    return result;
}

/**
 * Get the Dep instance for a proxied object
 * @param data Object to check
 * @returns Dep instance or undefined
 */
function getProxyDep(data: any): Dep | undefined {
    if (isObject(data)) {
        return Reflect.get(data, OBJECTPROXY_DEPID);
    }
}

/**
 * Create a reactive version of an object
 * @param data Object to observe
 * @param clone Whether to clone the object before observing
 * @returns Reactive object
 */
export function observer<T extends Object>(data: T, clone: boolean = false): T {
    if (checkEnableProxy(data) === false) {
        throw new Error("The provided data is not of the correct type. It must be an array or an object.");
    }

    if (clone) {
        return proxyData(deepClone(data));
    } else {
        return proxyData(data);
    }
}

/**
 * Define a reactive property on an object
 * @param target Object to define property on
 * @param key Property key
 * @param value Property value
 */
export function defineObserverProperty(target: any, key: string | symbol | number, value: any) {
    let propertyVal: any = value;

    if (checkEnableProxy(value)) {
        // Observe object values
        propertyVal = observer(value);
    }

    let dep = new Dep();

    Object.defineProperty(target, key, {
        // Enumerable and configurable
        enumerable: true,
        configurable: true,
        get: () => {
            dep.depend(key);

            // Track nested dependencies
            getProxyDep(propertyVal)?.depend(OBJECTPROXY_DEPLEVE_ID);

            return propertyVal;
        },
        set: (value) => {
            if (value === propertyVal) {
                return;
            }

            if (checkEnableProxy(value)) {
                // Observe new object values
                value = observer(value);
            }

            propertyVal = value;

            // Notify dependents
            notifyDep(dep, key);
        }
    });
}

const JOKER_SHALLOW_OBSERVER_TAG = Symbol.for("JOKER_SHALLOW_OBSERVER");
/**
 * Shallow observer that watches only the root value
 * @returns Shallow observer instance
 */
export class ShallowObserver<T> {
    [JOKER_SHALLOW_OBSERVER_TAG] = true;
    private dep = new Dep();
    constructor(private data: T) {}

    /**
     * Flag indicating if the value has changed
     */
    public isChanged: boolean = false;

    get value() {
        this.dep.depend(OBJECTPROXY_DEPLEVE_ID);
        return this.data;
    }

    set value(newVal) {
        if (Object.is(newVal, this.data) === false) {
            this.isChanged = true;

            this.data = newVal;
            notifyDep(this.dep, OBJECTPROXY_DEPLEVE_ID);
        }
    }
}

/**
 * Flag indicating if combined replies are active
 */
let isCombined = false;
/**
 * Queue for collecting combined dependency updates
 */
let combinedReplyQueue: Map<Dep, Array<string | symbol | number>> = new Map();

/**
 * Notify a dependency, either immediately or queue for combined reply
 */
function notifyDep(dep: Dep, key: string | symbol | number) {
    // Direct notification when not combining
    if (isCombined === false) dep.notify(key);
    // Queue for combined notification
    else {
        let depQueue = combinedReplyQueue.get(dep);
        if (depQueue === undefined) {
            depQueue = [];
            combinedReplyQueue.set(dep, depQueue);
        }

        if (!depQueue.includes(key)) {
            depQueue.push(key);
        }
    }
}

/**
 * Combine multiple dependency updates into a single notification
 * @param func Function containing changes to combine
 */
export function combinedReply(func: Function) {
    isCombined = true;

    try {
        func();
    } catch (e: any) {
        isCombined = false;
        combinedReplyQueue.clear();
        logger.error(
            "Data Hijacking",
            "Encountered a blocking error while collecting changes for data hijacking composite responses. No action will be taken. Please investigate.",
            e
        );
        return;
    }

    isCombined = false;

    // Notify all queued dependencies
    notifyGroupDeps(combinedReplyQueue);
    combinedReplyQueue.clear();
}

/**
 * Check if an object is being observed
 */
export function isObserverData(data: any) {
    return getProxyDep(data) !== undefined;
}
