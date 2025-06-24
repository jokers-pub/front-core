type Constructor<T = any> = new (...args: any[]) => T;

/**
 * IOC Dependency Injection Container
 *
 * Applicable scenarios for IOC dependency injection:
 * APIs and Interfaces that are internally planned but need external logic injection.
 * Different from plugins, which are aspect injections based on the overall lifecycle.
 */
export namespace IContainer {
    let bindings: Map<symbol | string, Constructor> = new Map();

    /**
     * Bind a tag identifier to a constructor
     * @param tagId Unique identifier for the binding
     * @returns Object with 'to' method to specify the target constructor
     */
    export function bind<T>(tagId: symbol | string) {
        return {
            to: (target: Constructor<T>) => {
                if (bindings.has(tagId)) {
                    throw new Error(
                        `TagId:${tagId.toString()} already has an implementation bound. Do not bind again.`
                    );
                }

                bindings.set(tagId, target);
            }
        };
    }

    /**
     * Resolve a dependency by tag identifier
     * @param tagId Unique identifier for the binding
     * @param params Parameters to pass to the constructor
     * @returns New instance of the bound constructor, or undefined if not found
     */
    export function get<T>(tagId: symbol | string, ...params: any[]): T | undefined {
        const target = bindings.get(tagId);

        if (target) {
            return new target(...params);
        }

        return undefined;
    }
}
