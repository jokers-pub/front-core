export type GlobalFunctionType = (...args: any[]) => any;

//全局方法
export const __GLONAL_FUNTIONS__: Record<string, GlobalFunctionType> = {};

/**
 * 注册全局组件
 * @param components 组件
 */
export function registerGlobalFunction(filters: Record<string, GlobalFunctionType>): void {
    for (let name in filters) {
        __GLONAL_FUNTIONS__[name] = filters[name];
    }
}

/**
 * 根据注册key获取组件
 * @param name 组件名称
 * @returns 组件
 */
export function getGlobalFunction(key: string): GlobalFunctionType | undefined {
    return __GLONAL_FUNTIONS__[key];
}
