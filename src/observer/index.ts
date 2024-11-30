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
import { JOKER_COMPONENT_TAG, JOKER_VNODE_TAG } from "../index";

/**
 * 存放劫持对象的Dep的Key
 */
export const OBJECTPROXY_DEPID = Symbol.for("__JOKER_OBJECT_PROXY_DEP_ID__");

const OBJECTPROXY_DATA_KEY = Symbol.for("__JOKER_OBJECT_PROXY_DATA_KEY__");

/**
 * 针对深度劫持关系时，需要给该对象做一个虚拟劫持的关系Key，方便事件传播
 */
const OBJECTPROXY_DEPLEVE_ID = Symbol.for("__JOKER_OBJECTPROXY_DEPLEVE_ID__");

/**
 * 检测是否允许劫持代理
 * @param data
 * @returns
 */
function checkEnableProxy(data: any): boolean {
    return (
        isObject(data) &&
        data instanceof Window === false &&
        data !== window.parent &&
        (Array.isArray(data) || isPlainObject(data)) &&
        //可扩展
        Object.isExtensible(data) &&
        //非冻结
        !Object.isFrozen(data) &&
        !(data instanceof Element) &&
        !(JOKER_VNODE_TAG in data) &&
        !(JOKER_SHALLOW_OBSERVER_TAG in data) &&
        !(JOKER_COMPONENT_TAG in data)
    );
}

function proxyData<T extends object>(data: T): T {
    let proxyDepTarget = getProxyDep(data);

    //如果当前数据已经被数据劫持，则直接返回，防止重复劫持监听
    if (proxyDepTarget) {
        return data;
    }

    let readiedData = Reflect.get(data, OBJECTPROXY_DATA_KEY);
    if (readiedData) {
        return readiedData as T;
    }

    let dep = new Dep();

    //首次重置值
    let resetData = true;

    let result = new Proxy(data, {
        get(target: any, key: string | symbol, receiver: any) {
            // 该属性是为了解决非proxy下的数据重复依赖劫持问题
            // 如果直接获取proxy中的该属性，可能是全属性遍历，这时返回undefined即可
            //@ts-ignore
            if (key === OBJECTPROXY_DATA_KEY) {
                return undefined;
            }

            if (key === OBJECTPROXY_DEPID) {
                return dep;
            }

            //空索引
            if (key === OBJECTPROXY_DEPLEVE_ID) {
                return undefined;
            }

            let result = Reflect.get(target, key);

            if (hasProperty(target, key) === false && key !== "length") {
                return result;
            }

            dep.depend(key);

            if (checkEnableProxy(result)) {
                //如果是可劫持对象，并且存在Dep关系，则做深度为1的空key关系
                //如果不是，并且没有被劫持，理论上不存在，可能由Object原型方法添加，不做考虑
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
                //如果是对象，则对其进行数据依赖采集
                value = observer(value);
            }
            let isNewProperty = hasOwnProperty(target, key) === false;

            let isChange = Reflect.get(target, key) !== value;

            Reflect.set(target, key, value);

            //这里之所以要对长度排除，是因为新增值，会先对索引赋值，索引赋值后才会变更length，这时length已变更，无法进行有效比对
            if (isChange || (key === "length" && Array.isArray(target))) notifyDep(dep, key);

            //数组长度变更，属于数组change，则对该对象做change广播
            if (Array.isArray(target)) {
                key === "length" && notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
            } else if (isNewProperty) {
                //Object 类型，监听新属性增加
                notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
            }

            return true;
        },
        deleteProperty(target: object, key: string | symbol): boolean {
            Reflect.deleteProperty(target, key);

            //操作成功 && 非数组，删除属性时，要进行广播
            if (Array.isArray(target) === false) {
                notifyDep(dep, OBJECTPROXY_DEPLEVE_ID);
            }

            return true;
        }
    });

    //新增临时挂载，已解决循环数据引用一致性问题
    defineProperty(data, OBJECTPROXY_DATA_KEY, result, false);

    //对所有可被劫持的属性进行深度遍历劫持
    for (let key in data) {
        let itemData = data[key];
        //可被代理 && 没有代理
        if (checkEnableProxy(itemData) && !getProxyDep(itemData)) {
            //@ts-ignore
            result[key] = proxyData(data[key]);
        }
    }
    resetData = false;

    return result;
}

/**
 * 获取劫持对象的Dep
 * @param data
 * @returns
 */
function getProxyDep(data: any): Dep | undefined {
    //@ts-ignore
    if (isObject(data)) {
        return Reflect.get(data, OBJECTPROXY_DEPID);
    }
}

/**
 * 数据劫持
 * @param data 数据
 * @param clone 是否clone
 * @returns 返回可观察对象
 */
export function observer<T extends Object>(data: T, clone: boolean = false): T {
    if (checkEnableProxy(data) === false) {
        throw new Error("当前传入的数据不是正确的数据类型，必须是数组或者对象");
    }

    if (clone) {
        return proxyData(deepClone(data));
    } else {
        return proxyData(data);
    }
}

/**
 * 定义可劫持观察的属性
 *
 * 该方法会污染value深层，如想纯净数据，自行clone
 * @param target
 * @param key
 * @param value
 */
export function defineObserverProperty(target: any, key: string | symbol, value: any) {
    let propertyVal: any = value;

    if (checkEnableProxy(value)) {
        //如果是对象，则对其进行数据依赖采集
        propertyVal = observer(value);
    }

    let dep = new Dep();

    Object.defineProperty(target, key, {
        //可枚举
        enumerable: true,
        //不可再定义
        configurable: true,
        get: () => {
            dep.depend(key);

            //如果是可劫持对象，并且存在Dep关系，则做深度为1的空key关系
            getProxyDep(propertyVal)?.depend(OBJECTPROXY_DEPLEVE_ID);

            return propertyVal;
        },
        set: (value) => {
            if (value === propertyVal) {
                return;
            }

            if (checkEnableProxy(value)) {
                //如果是对象，则对其进行数据依赖采集
                value = observer(value);
                //不做深层通知
            }

            propertyVal = value;

            notifyDep(dep, key);
        }
    });
}

const JOKER_SHALLOW_OBSERVER_TAG = Symbol.for("JOKER_SHALLOW_OBSERVER");
/**
 * 浅劫持监听，不污染数据源，只对根值监听，不对属性监听
 * @returns
 */
export class ShallowObserver<T> {
    [JOKER_SHALLOW_OBSERVER_TAG] = true;
    private dep = new Dep();
    constructor(private data: T) {}

    /**
     * 是否有变更
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
 * 用于标记是否是组合回复
 */
let isCombined = false;
/**
 * 组合回复采集队列
 */
let combinedReplyQueue: Map<Dep, Array<string | symbol>> = new Map();

/**
 * 通知dep，通过isCombined执行不同的流程
 */
function notifyDep(dep: Dep, key: string | symbol) {
    //非合并回复直接回复
    if (isCombined === false) dep.notify(key);
    //合并回复，做去重收集
    else {
        let depQueue = combinedReplyQueue.get(dep);
        if (depQueue === undefined) {
            depQueue = [];
            combinedReplyQueue.set(dep, depQueue);
        }

        if (depQueue.includes(key) === false) {
            depQueue.push(key);
        }
    }
}

/**
 * 组合回复，针对大量值变更，又不想频繁更新DOM，
 * 可通过该方法实现一个作用域内的统一组合回复
 * @param func 处理方法
 * @returns
 */
export function combinedReply(func: Function) {
    isCombined = true;

    try {
        func();
    } catch (e: any) {
        isCombined = false;
        combinedReplyQueue.clear();
        logger.error("数据劫持", "数据劫持组合回复在做变更采集时，遇到了阻塞错误，不做响应，请检查", e);
        return;
    }

    isCombined = false;

    //组合回复
    notifyGroupDeps(combinedReplyQueue);
    combinedReplyQueue.clear();
}

/**
 * 判断一个值是否是已被数据代理劫持
 */
export function isObserverData(data: any) {
    return getProxyDep(data) !== undefined;
}
