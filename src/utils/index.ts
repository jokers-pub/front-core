import { isPlainObject } from "@joker.front/shared";

export function resolveDeepPromisesInPlace(obj: any, deep?: boolean): Promise<any> | undefined {
    if (!obj) return obj;
    if (obj instanceof Promise) {
        return obj.then((resolved) => Promise.resolve(resolved));
    } else if (Array.isArray(obj) && obj.length) {
        let promisesInArray: Array<Promise<any>> = [];
        for (let index in obj) {
            let item = obj[index];
            let cPromise;
            if (deep) {
                cPromise = resolveDeepPromisesInPlace(item, deep);
            } else {
                cPromise = item;
            }
            if (cPromise instanceof Promise) {
                promisesInArray.push(
                    cPromise.then((resolved) => {
                        obj[index] = resolved;
                    })
                );
            }
        }

        if (promisesInArray.length > 0) {
            return Promise.all(promisesInArray).then(() => Promise.resolve(obj));
        }
    } else if (typeof obj === "object" && obj !== null && isPlainObject(obj) && obj instanceof Element === false) {
        let objectPromises: Array<Promise<any>> = [];
        for (let key in obj) {
            let value = obj[key];
            if (value instanceof Promise) {
                objectPromises.push(
                    value.then((resolved) => {
                        obj[key] = resolved;
                    })
                );
            } else if (deep) {
                let cPromise = resolveDeepPromisesInPlace(value, deep);
                if (cPromise instanceof Promise) {
                    objectPromises.push(cPromise);
                }
            }
        }

        if (objectPromises.length) {
            return Promise.all(objectPromises).then(() => {
                return obj;
            });
        }
    }

    return obj;
}
export function isGetterProperty(obj: object, prop: string) {
    if (!obj.constructor) return false;
    let descriptor = Object.getOwnPropertyDescriptor(obj.constructor.prototype, prop);
    return descriptor && descriptor.get;
}
