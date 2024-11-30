import { guid, isEqual, isObject, isPlainObject, logger } from "@joker.front/shared";
import { Dep } from "./dep";
const LOGTAG = "数据观察";
export const BREAK_WATCH_UPDATE = Symbol.for("JOKER_BREAK_WATCH_UPDATE");
/**
 * 将取值表达式转换为get方法
 * @param exp
 * @returns
 */
function transformGetter(exp: string): Function | undefined {
    //过滤非正常属性
    if (/[^\w.$]/.test(exp)) {
        return;
    }

    let exps = exp.split(".");

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
 * 观察者
 *
 * 负责观察对象，并收集依赖关系，并在值变更时做出回调响应
 */
export class Watcher<T extends object = any> {
    id = guid();
    private getter!: Function;

    public value: any;

    public isDestroy = false;

    public updating = false;
    /**
     * 运行时的关系收集
     *
     * 主要作用是：运行时做基本的重复过滤,并收集当前“有效的”Dep关系
     * 一个Dep 肯定对应一个对象， 对象的key不会出现重复
     */
    private runRelations: Map<Dep, Array<string | symbol>> = new Map();

    /**
     * 实际关系
     */
    public relations: Map<Dep, Array<string | symbol>> = new Map();

    /**
     *
     * @param ob 数据源
     * @param expOrFn 表达式（string｜Function）
     * @param updateCallBack update回调
     * @param forceCallBack 是否强制回调， 有些值未变更时也会强制回调
     */
    constructor(
        private ob: T | (() => T),
        private updateCallBack: Function,
        expOrFn?: string | ((obj: T) => any | void) | Function,
        private forceCallBack?: boolean
    ) {
        if (ob === undefined) {
            throw new Error("无法对underfind进行变更观察");
        }

        if (expOrFn === undefined) {
            this.getter = (obj: any) => obj;
        } else if (typeof expOrFn === "function") {
            this.getter = expOrFn;
        } else {
            let getFunc = transformGetter(expOrFn);

            if (getFunc === undefined) {
                throw new Error(expOrFn + "解析失败，无法明确读取表达式，请检查expOrFn参数，或采用function模式");
            }
            this.getter = getFunc;
        }

        if (this.getter === undefined) {
            logger.error(LOGTAG, "getter创建失败", arguments);
        }

        this.value = this.getValue();
    }

    public getValue() {
        //当前watcher被销毁，可能存在从下向上的监听广播，这里不做处理
        if (this.getter === undefined) {
            return;
        }

        Dep.target = this;

        let targetData = typeof this.ob === "function" ? this.ob() : this.ob;
        let value;
        try {
            value = this.getter.call(targetData, targetData);
        } catch (e) {
            logger.error(LOGTAG, `获取值失败，执行方法：${this.getter.toString()}`);
            throw e;
        }
        Dep.target = undefined;

        this.clearnDeps();
        return value;
    }

    /**
     * 添加Dep关系
     * @param dep
     * @param key
     */
    public addDep(dep: Dep, key: string | symbol) {
        let runItem = this.runRelations.get(dep);

        if (runItem === undefined || runItem.includes(key) === false) {
            runItem = runItem || [];
            runItem.push(key);

            this.runRelations.set(dep, runItem);

            let depItem = this.relations.get(dep);
            //判断之前有没有该关系的存储，如果没有则添加
            //在最终clean时，会重新runRelations-》relations的转换
            if (depItem === undefined || depItem.includes(key) === false) {
                dep.addWatcher(key, this);
            }
        }
    }

    /**
     * 更新值，并对其进行响应
     */
    public update() {
        //通知过程中锁定，避免观察和响应之间循环调用
        if (this.updating) return;

        let newVal = this.getValue();

        if (newVal === BREAK_WATCH_UPDATE) return;

        let oldVal = this.value;

        //强制回调｜｜值变更｜｜值时个对象（对象时引用类型无法查看是否变更）
        if (this.forceCallBack || newVal !== oldVal || isObject(newVal)) {
            this.value = newVal;

            //这里过滤一些引用不想等，但值相等的值，只是不做响应，但不影响下次的值变更
            //这里没有过滤掉this.value = newVal;
            if (newVal !== oldVal && !this.forceCallBack && isEqual(newVal, oldVal, true)) {
                return;
            }
            this.updating = true;
            try {
                this.updateCallBack(newVal, oldVal);
            } catch (e) {
                throw e;
            } finally {
                this.updating = false;
            }
        }
    }

    public destroy() {
        this.relations.forEach((keys, dep) => {
            for (let key of keys) {
                dep.removeWatcher(key, this);
            }
        });

        this.isDestroy = true;

        this.relations.clear();
        this.runRelations.clear();
        this.ob = <any>undefined;
        this.value = undefined;
        this.getter = <any>undefined;
    }

    private clearnDeps() {
        this.relations.forEach((keys, dep) => {
            let runItem = this.runRelations.get(dep);
            for (let key of keys) {
                if (runItem) {
                    if (runItem.includes(key) === false) {
                        dep.removeWatcher(key, this);
                    }
                } else {
                    //移除所有的dep属性关系
                    //不移除dep，因为对象属性还在
                    dep.removeWatcher(key, this);
                }
            }
        });

        this.relations.clear();
        this.relations = this.runRelations;

        this.runRelations = new Map();
    }
}
