export type GlobalFunctionType = (...args: any[]) => any;

// Global functions
export const __GLONAL_FUNTIONS__: Record<string, GlobalFunctionType> = {};

/**
 * Register global functions
 * @param functions Object containing function names and implementations
 */
export function registerGlobalFunction(functions: Record<string, GlobalFunctionType>): void {
    for (const name in functions) {
        __GLONAL_FUNTIONS__[name] = functions[name];
    }
}

/**
 * Get a registered global function by key
 * @param key Function name
 * @returns Registered function or undefined if not found
 */
export function getGlobalFunction(key: string): GlobalFunctionType | undefined {
    return __GLONAL_FUNTIONS__[key];
}
