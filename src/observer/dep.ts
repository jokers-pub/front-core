import { remove, removeFilter } from "@joker.front/shared";
import { Watcher } from "./watcher";

/**
 * Dependency manager acting as a bridge between watchers and proxied objects
 * Data change flow: Ob -> dep -> watcher
 * Dependency setup flow: watcher -> dep
 */
export class Dep {
    /**
     * Current target watcher
     *
     * Set this static value before changing a value to collect dependencies,
     * clear it after setup.
     *
     * Using a static value instead of a method allows handling
     * multiple value changes/reads.
     */
    public static target?: Watcher<any>;

    public watchers: Map<string | symbol | number, Watcher<any>[]> = new Map();

    /**
     * Establish a dependency for a key
     * @param key Property key to depend on
     */
    public depend(key: string | symbol | number) {
        Dep.target?.addDep(this, key);
    }

    /**
     * Add a watcher for a key
     * @param key Property key to watch
     * @param watcher Watcher instance to add
     */
    public addWatcher(key: string | symbol | number, watcher: Watcher<any>) {
        let watchers = this.watchers.get(key) || [];

        watchers.push(watcher);

        this.watchers.set(key, watchers);
    }

    /**
     * Remove a watcher for a key
     * @param key Property key to unwatch
     * @param watcher Watcher instance to remove
     */
    public removeWatcher(key: string | symbol | number, watcher: Watcher<any>) {
        const watchers = this.watchers.get(key);

        if (watchers) {
            remove(watchers, watcher);
        }
    }

    /**
     * Notify watchers of a key change
     * @param key Property key that changed
     */
    public notify(key: string | symbol | number) {
        const watchers = this.watchers.get(key);

        if (watchers) {
            // Remove destroyed watchers
            removeFilter(watchers, (w) => w.isDestroy);

            /**
             * Use a copy of watchers to avoid issues with
             * dynamic additions/removals during notification
             */
            const _watchers = [...watchers];

            _watchers.forEach((w) => {
                if (!w.isDestroy) {
                    w.update();
                }
            });
        }
    }
}

/**
 * Notify groups of dependencies in a batch
 * @param list Map of Dep instances to their respective keys
 */
export function notifyGroupDeps(list: Map<Dep, Array<string | symbol | number>>) {
    const watchers: Watcher[] = [];
    const hasNotifyWatchers: Watcher[] = [];

    // Flatten watchers to avoid dynamic changes during notification
    list.forEach((keys, dep) => {
        keys.forEach((key) => {
            watchers.push(...(dep.watchers.get(key) || []));
        });
    });

    watchers.forEach((watcher) => {
        if (hasNotifyWatchers.includes(watcher)) return;

        !watcher.isDestroy && watcher.update();

        hasNotifyWatchers.push(watcher);
    });
}
