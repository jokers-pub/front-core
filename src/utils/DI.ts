type Constructor<T = any> = new (...args: any[]) => T;

/**
 * IOC依赖注入容器
 *
 * IOC依赖注入适用场景：
 * 内部已规划的API、Interface，需要在外部对其进行逻辑注入的场景
 * 区分于plugin，plugin是根据整体声明周期做的切面注入
 */
export namespace IContainer {
    let binds: Map<symbol | string, Constructor> = new Map();

    export function bind<T>(tagId: symbol | string) {
        return {
            to: (target: Constructor<T>) => {
                if (binds.has(tagId)) {
                    throw new Error(`TagId:${tagId.toString()}已注入实现类，请勿重复注入。`);
                }

                binds.set(tagId, target);
            }
        };
    }

    export function get<T>(tagId: symbol | string, ...params: any[]): T | undefined {
        let target = binds.get(tagId);

        if (target) {
            return new target(...params);
        }
        return;
    }
}
