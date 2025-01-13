export function isGetterProperty(obj: object, prop: string) {
    if (!obj.constructor) return false;
    let descriptor = Object.getOwnPropertyDescriptor(obj.constructor.prototype, prop);
    return descriptor && descriptor.get;
}
