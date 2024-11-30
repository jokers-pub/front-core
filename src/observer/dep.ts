import { guid, remove, removeFilter } from "@joker.front/shared";
import { Watcher } from "./watcher";

/**
 * 作为观察者和对象代理中间的关系桥
 * 数据变更时：Ob->dep->watcher
 * 设置依赖时：watcher->dep
 */
export class Dep {
    /**
     * 关系id，仅在production模式下生效
     */
    id: string = process.env.NODE_ENV === "production" ? "" : guid();

    /**
     * 当前目标的监听者
     *
     * 在更改值之前，设置该静态值，使其在值变更时收集相应的依赖关系
     * 设置完毕后清除该值
     *
     * 之所以采用静态值，不采用方法的原因：
     * 可能存在多值变更，或者读取
     */
    public static target?: Watcher<any>;

    public watchers: Map<string | symbol, Watcher<any>[]> = new Map();

    /**
     * 设置依赖
     * @param key
     */
    public depend(key: string | symbol) {
        Dep.target?.addDep(this, key);
    }

    /**
     * 添加观察者
     * @param key
     * @param watcher
     */
    public addWatcher(key: string | symbol, watcher: Watcher<any>) {
        let watchers = this.watchers.get(key) || [];

        watchers.push(watcher);

        this.watchers.set(key, watchers);
    }

    /**
     * 删除观察者
     * @param key
     * @param watcher
     */
    public removeWatcher(key: string | symbol, watcher: Watcher<any>) {
        let watchers = this.watchers.get(key);

        if (watchers) {
            remove(watchers, watcher);
        }
    }

    /**
     * 通知key下面的观察者
     * @param key
     */
    public notify(key: string | symbol) {
        let watchers = this.watchers.get(key);

        if (watchers) {
            //移除已经销毁的数据
            removeFilter(watchers, (w) => {
                return w.isDestroy;
            });

            /**
             * 由于watchers 是个动态实时变化的
             * 所以通知时，只广播当前的观察者列队
             * 动态新增删除的不做处理
             */
            let _watchers = [...watchers];

            _watchers.forEach((w) => {
                if (w.isDestroy === false) {
                    w.update();
                }
            });
        }
    }
}

export function notifyGroupDeps(list: Map<Dep, Array<string | symbol>>) {
    let watchers: Watcher[] = [];
    let hasNotifyWatchers: Watcher[] = [];

    //这里将队列重新排列，防止过程中新增监听造成不必要的循环广播
    list.forEach((keys, dep) => {
        keys.forEach((key) => {
            watchers.push(...(dep.watchers.get(key) || []));
        });
    });

    watchers.forEach((n) => {
        if (hasNotifyWatchers.includes(n)) return;

        n.isDestroy === false && n.update();

        hasNotifyWatchers.push(n);
    });
}
