import { isPlainObject, toLowerCase } from "@joker.front/shared";

export type PropValueType = String | ArrayConstructor | Number | Object | Function | Boolean;

export type PropTypeFullModel = {
    type?: PropValueType | Array<PropValueType>;
    required?: Boolean;
    default?: any;
    validate?: (val: any) => Boolean;
};

export type PropType = PropValueType | Array<PropValueType> | PropTypeFullModel;

function checkPropType(key: string | symbol, value: any, types: PropValueType | Array<PropValueType>): any {
    //undefined 不做约束
    if (value === undefined) {
        return;
    }

    let checkTypes: PropValueType[] = Array.isArray(types) ? types : [types];

    for (let checkType of checkTypes) {
        //解决proxy<Array> 场景下的类型判断异常问题
        if (checkType === Array && value instanceof Array) {
            return value;
        }

        if (typeof value === (<Function>checkType).name.toLocaleLowerCase()) {
            return value;
        }
    }

    //使用第一个类型兼容转换
    switch (checkTypes[0]) {
        case Number:
            let newVal = Number(value);
            if (isNaN(newVal) === false) {
                return newVal;
            }
            break;

        case String:
            return String(value);
    }

    throw new Error(`props中${key.toString()}的类型不符合约束类型`);
}

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

    if (key in propsData) {
        propValue = propsData[key];
    } else if (patchKey) {
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
        if (
            isPlainObject(propOption) &&
            ("type" in propOption || "required" in propOption || "default" in propOption || "validate" in propOption)
        ) {
            let fullModel = <PropTypeFullModel>propOption;

            if (fullModel.required && propValue === undefined) {
                throw new Error(`props中key:${key.toString()}是必须项，请检查`);
            }

            if (fullModel.type) {
                propValue = checkPropType(key, propValue, fullModel.type);
            }

            if (fullModel.validate && fullModel.validate(propValue) === false) {
                throw new Error(`props中key${key.toString()}的值校验错误`);
            }

            propValue = propValue ?? fullModel.default;
        } else if (isPropsType(propOption)) {
            propValue = checkPropType(key, propValue, propOption);
        } else {
            //默认值
            propValue = propValue ?? propOption;
        }

        return propValue;
    }

    return propValue;
}

function isPropsType(propOption: any): boolean {
    if ([String, Array, Number, Object, Function, Boolean].includes(propOption)) {
        return true;
    }

    if (propOption instanceof Array) {
        return isPropsType(propOption[0] as any);
    }
    return false;
}
