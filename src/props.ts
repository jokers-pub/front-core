import { isPlainObject, toLowerCase } from "@joker.front/shared";

export type PropValueType = String | ArrayConstructor | Number | Object | Function | Boolean;

export type PropTypeFullModel = {
    type?: PropValueType | Array<PropValueType>;
    required?: Boolean;
    default?: any;
    validate?: (val: any) => Boolean;
};

export type PropType = PropValueType | Array<PropValueType> | PropTypeFullModel;

/**
 * Check if a prop value matches the specified type(s)
 * @param key Prop key
 * @param value Prop value
 * @param types Expected type(s)
 * @returns The original or converted value if valid, otherwise throws an error
 */
function checkPropType(key: string | symbol, value: any, types: PropValueType | Array<PropValueType>): any {
    // Undefined values are allowed (handled by required flag)
    if (value === undefined) {
        return;
    }

    const checkTypes: PropValueType[] = Array.isArray(types) ? types : [types];

    for (const checkType of checkTypes) {
        // Handle Array type explicitly due to proxy issues
        if (checkType === Array && Array.isArray(value)) {
            return value;
        }

        // Check primitive types by lowercase comparison
        if (typeof value === (<Function>checkType).name.toLowerCase()) {
            return value;
        }
    }

    // Attempt type conversion for the first specified type
    switch (checkTypes[0]) {
        case Number:
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                return numValue;
            }
            break;

        case String:
            return String(value);
    }

    throw new Error(`The type of ${key.toString()} in props does not match the constrained type`);
}

/**
 * Get and validate a prop value based on its definition
 * @param propsData Source props data
 * @param key Prop key
 * @param propsType Prop type definition
 * @returns Validated and processed prop value
 */
export function getPropValue(
    propsData: Readonly<Record<string | symbol, any>>,
    key: string | symbol,
    propsType?: Record<string | symbol, any>
) {
    let patchKey: string | undefined;
    if (typeof key !== "symbol") {
        patchKey = toLowerCase(key);
    }

    let propValue: any;

    // Check for exact key match first
    if (key in propsData) {
        propValue = propsData[key];
    }
    // Then check for case-insensitive match
    else if (patchKey) {
        propValue = propsData[patchKey];
    }

    let propOption: any;
    if (propsType) {
        if (key in propsType) {
            propOption = propsType[key];
        } else if (patchKey && patchKey in propsType) {
            propOption = propsType[patchKey];
        }
    }

    if (propOption !== undefined) {
        // Handle full model definition
        if (
            isPlainObject(propOption) &&
            ("type" in propOption || "required" in propOption || "default" in propOption || "validate" in propOption)
        ) {
            const fullModel = <PropTypeFullModel>propOption;

            // Check required flag
            if (fullModel.required && propValue === undefined) {
                throw new Error(`props key:${key.toString()} is required, please check`);
            }

            // Validate type
            if (fullModel.type) {
                propValue = checkPropType(key, propValue, fullModel.type);
            }

            // Run custom validation
            if (fullModel.validate && fullModel.validate(propValue) === false) {
                throw new Error(`Validation failed for props key ${key.toString()}`);
            }

            // Apply default value if needed
            propValue = propValue ?? fullModel.default;
        }
        // Handle shorthand type definition
        else if (isPropsType(propOption)) {
            propValue = checkPropType(key, propValue, propOption);
        }
        // Treat as default value
        else {
            propValue = propValue ?? propOption;
        }

        return propValue;
    }

    return propValue;
}

/**
 * Check if a value represents a valid prop type definition
 * @param propOption Value to check
 * @returns True if valid prop type, false otherwise
 */
function isPropsType(propOption: any): boolean {
    if ([String, Array, Number, Object, Function, Boolean].includes(propOption)) {
        return true;
    }

    if (Array.isArray(propOption)) {
        return isPropsType(propOption[0] as any);
    }

    return false;
}
