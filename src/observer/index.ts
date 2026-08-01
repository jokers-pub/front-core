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
    if (data == null || typeof data !== "object") return false;
    if (Object.isFrozen(data)) return false;

    // 只代理数组、普通对象、Set、Map
    const isObservableType = Array.isArray(data) || isPlainObject(data) || data instanceof Set || data instanceof Map;
    if (!isObservableType) return false;

    // 内部标记判断，避免代理框架内部对象
    return !(
        JOKER_VNODE_TAG in data ||
        JOKER_SHALLOW_OBSERVER_TAG in data ||
        JOKER_COMPONENT_TAG in data ||
        OBJECTPROXY_DEPID in data
    );
}

/**
 * Create a reactive proxy for an object
 * @param data Object to proxy
 * @returns Proxied object
 */
function proxyData<T extends object | Set<any>>(data: T): T {
    // 极端边界场景防御：data为空或非对象直接返回，避免报错
    if (data == null || typeof data !== "object") {
        return data;
    }

    // Return existing proxy if already observed
    if (getProxyDep(data)) {
        return data;
    }

    // Check for existing proxy data key
    if (hasOwnProperty(data, OBJECTPROXY_DATA_KEY)) {
        const readiedData = Reflect.get(data, OBJECTPROXY_DATA_KEY);
        if (readiedData) {
            return readiedData as T;
        }
    }

    const dep = new Dep();
    const isSetOrMap = data instanceof Set || data instanceof Map;
    const mutableMethods = new Set(["add", "set", "delete", "clear"]);

    // Flag to skip notifications during initial setup
    let resetData = true;

    const result = new Proxy(data, {
        get(target: any, key: string | symbol, receiver: any) {
            // 内部Key处理
            if (key === OBJECTPROXY_DEPID) return dep;
            if (key === OBJECTPROXY_DATA_KEY || key === OBJECTPROXY_DEPLEVE_ID) return undefined;
            if (key === Symbol.toStringTag) return Reflect.get(target, key);

            const value = Reflect.get(target, key, receiver);

            // Set/Map可变方法代理
            if (isSetOrMap && typeof value === "function") {
                if (mutableMethods.has(key as string)) {
                    return (...args: any[]) => {
                        // 自动代理新值
                        if (key === "add" || key === "set") {
                            const valIdx = key === "add" ? 0 : 1;
                            if (checkEnableProxy(args[valIdx])) {
                                args[valIdx] = observer(args[valIdx]);
                            }
                        }
                        const callResult = value.apply(target, args);
                        // 触发更新
                        const hasChange = key !== "delete" || callResult === true;
                        if (hasChange) {
                            notifyDep(dep, "size");
                            notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
                        }
                        return callResult;
                    };
                }
                return value.bind(target);
            }

            // 仅在依赖收集阶段执行追踪
            if (Dep.target) {
                const hasKey = key === "length" || key === "size" || hasOwnProperty(target, key);
                if (hasKey) {
                    dep.depend(key);
                    if (checkEnableProxy(value)) {
                        getProxyDep(value)?.depend(OBJECTPROXY_DEPLEVE_ID);
                    }
                }
            }

            return value;
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
            const hasKey = hasOwnProperty(target, key);
            Reflect.deleteProperty(target, key);

            // 数组删除元素或对象删除属性都需要通知深度更新
            if (hasKey) {
                notifyDep(dep, key);
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
    // 高频调用，仅判断非空和对象类型，避免原始值调用Reflect.get报错
    return data != null && typeof data === "object" ? Reflect.get(data, OBJECTPROXY_DEPID) : undefined;
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
    let propertyVal: any = checkEnableProxy(value) ? observer(value) : value;
    const dep = new Dep();

    Object.defineProperty(target, key, {
        enumerable: true,
        configurable: true,
        get: () => {
            // 核心性能优化：非依赖收集阶段直接返回值，无额外函数调用开销
            if (Dep.target === undefined) return propertyVal;

            dep.depend(key);
            // Track nested dependencies
            const nestedDep = getProxyDep(propertyVal);
            if (nestedDep) nestedDep.depend(OBJECTPROXY_DEPLEVE_ID);

            return propertyVal;
        },
        set: (newVal) => {
            if (Object.is(newVal, propertyVal)) return;

            propertyVal = checkEnableProxy(newVal) ? observer(newVal) : newVal;
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
    // Direct notification when not combining (99%场景，优先判断)
    if (isCombined === false) {
        dep.notify(key);
        return;
    }
    // Queue for combined notification
    let depQueue = combinedReplyQueue.get(dep);
    if (depQueue === undefined) {
        depQueue = [];
        combinedReplyQueue.set(dep, depQueue);
        depQueue.push(key);
    } else if (!depQueue.includes(key)) {
        depQueue.push(key);
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

        // 循环处理所有队列中的更新，包括更新过程中新增的变更，直到队列清空
        while (combinedReplyQueue.size > 0) {
            const currentQueue = new Map(combinedReplyQueue);
            combinedReplyQueue.clear();
            notifyGroupDeps(currentQueue);
        }
    } catch (e: any) {
        logger.error(
            "Data Hijacking",
            "Encountered a blocking error while collecting changes for data hijacking composite responses. No action will be taken. Please investigate.",
            e
        );
        throw e;
    } finally {
        isCombined = false;
        combinedReplyQueue.clear();
    }
}

/**
 * Check if an object is being observed
 */
export function isObserverData(data: any) {
    return getProxyDep(data) !== undefined;
}
