import {
    defineObserverProperty,
    isObserverData,
    OBJECTPROXY_DEPID,
    observer,
    ShallowObserver
} from "../../src/observer";
import { Dep } from "../../src/observer/dep";

describe(`Data Proxy`, () => {
    let source = {
        total: "20",
        obj: {
            name: "John",
            age: "18",
            aaa: [1, 2, 3, 4, 5, 6]
        }
    };

    it("Data Conservation - Verify no data pollution", () => {
        let obj1 = observer(source);

        //@ts-ignore
        expect(obj1[OBJECTPROXY_DEPID] !== undefined).toBe(true);

        //@ts-ignore
        expect(source[OBJECTPROXY_DEPID] === undefined).toBe(true);

        //Create new instance
        let obj2 = observer(source);

        //Proxy data synchronization
        expect(obj1.obj === obj2.obj).toBe(true);

        //Clone proxy
        let obj3 = observer(source, true);

        obj2.total = "21";

        expect(obj3.total).toEqual("20");
    });

    it("Repeated Proxy", () => {
        let obj1 = observer(source);

        let obj2 = observer(obj1);

        expect(obj1 === obj2).toBe(true);
    });

    it("Shallow Proxy Observation", () => {
        expect(new ShallowObserver("1").value).toEqual("1");
        expect(new ShallowObserver(1).value).toEqual(1);

        let source = { a: 1, b: 2 };
        let target = new ShallowObserver(source);

        expect(target.value).toBe(source);
        target.value = {
            a: 2,
            b: 3
        };

        expect(target.isChanged).toBe(true);
        expect(target.value === source).toBe(false);
    });

    it("Circular Data Dependency", () => {
        let item = {
            name: "1",
            age: 2,
            children: [] as any[]
        };

        item.children.push({
            name: "2",
            age: 3,
            parent: item
        });
        let data = observer(item);

        expect(isObserverData(data) && data === data.children[0].parent).toBe(true);
    });

    it("Data Proxy - Data Loss Test", () => {
        let source = class {
            a = 1;
        };

        let data = observer(new source());
        let a = Object.create(data);
        defineObserverProperty(a, "temp", 1);

        expect(a.temp).toBe(1);

        let b = observer(a);

        expect(b.temp).toBe(1);

        let c = Object.create(b);

        let d = observer(c);

        expect(d.temp).toBe(1);
    });

    it("Set/Map size access should not throw error", () => {
        // 测试Set的size访问
        const set = observer(new Set([1, 2, 3]));
        expect(() => set.size).not.toThrow();
        expect(set.size).toBe(3);

        // 测试Set添加元素后size更新
        set.add(4);
        expect(set.size).toBe(4);

        // 测试Map的size访问
        const map = observer(
            new Map([
                ["a", 1],
                ["b", 2]
            ])
        );
        expect(() => map.size).not.toThrow();
        expect(map.size).toBe(2);

        // 测试Map设置元素后size更新
        map.set("c", 3);
        expect(map.size).toBe(3);

        // 测试Set删除元素
        set.delete(1);
        expect(set.size).toBe(3);

        // 测试Map删除元素
        map.delete("a");
        expect(map.size).toBe(2);

        // 测试清空Set
        set.clear();
        expect(set.size).toBe(0);

        // 测试清空Map
        map.clear();
        expect(map.size).toBe(0);
    });

    it("Set/Map all methods should work correctly", () => {
        // 测试Set所有方法
        const set = observer(new Set<number>());
        set.add(1);
        set.add(2);
        set.add(2); // 重复添加
        expect(set.has(1)).toBe(true);
        expect(set.has(2)).toBe(true);
        expect(set.has(3)).toBe(false);
        expect(set.size).toBe(2);

        // 测试遍历方法
        const values = [...set.values()];
        expect(values).toEqual([1, 2]);

        const keys = [...set.keys()];
        expect(keys).toEqual([1, 2]);

        const entries = [...set.entries()];
        expect(entries).toEqual([
            [1, 1],
            [2, 2]
        ]);

        // 测试forEach
        let forEachResult: number[] = [];
        set.forEach((val) => forEachResult.push(val));
        expect(forEachResult).toEqual([1, 2]);

        // 测试Map所有方法
        const map = observer(new Map<string, number>());
        map.set("a", 1);
        map.set("b", 2);
        expect(map.get("a")).toBe(1);
        expect(map.get("c")).toBeUndefined();
        expect(map.has("b")).toBe(true);
        expect(map.has("c")).toBe(false);
        expect(map.size).toBe(2);

        // 测试Map遍历方法
        const mapValues = [...map.values()];
        expect(mapValues).toEqual([1, 2]);

        const mapKeys = [...map.keys()];
        expect(mapKeys).toEqual(["a", "b"]);

        const mapEntries = [...map.entries()];
        expect(mapEntries).toEqual([
            ["a", 1],
            ["b", 2]
        ]);

        // 测试Map forEach
        let mapForEachResult: [string, number][] = [];
        map.forEach((val, key) => mapForEachResult.push([key, val]));
        expect(mapForEachResult).toEqual([
            ["a", 1],
            ["b", 2]
        ]);
    });

    it("Set/Map nested object should be reactive", () => {
        // 测试Set中嵌套对象自动代理
        const set = observer(new Set<{ name: string }>());
        const obj = { name: "test" };
        set.add(obj);

        // 验证嵌套对象已经被代理
        expect(isObserverData([...set.values()][0])).toBe(true);

        // 测试Map中嵌套对象自动代理
        const map = observer(new Map<string, { age: number }>());
        const nestedObj = { age: 18 };
        map.set("user", nestedObj);

        // 验证嵌套对象已经被代理
        expect(isObserverData(map.get("user"))).toBe(true);
    });

    it("Set/Map should work correctly with for...of iteration", () => {
        // 测试Set for...of遍历
        const set = observer(new Set([1, 2, 3]));
        const setResult: number[] = [];
        for (const item of set) {
            setResult.push(item);
        }
        expect(setResult).toEqual([1, 2, 3]);

        // 测试Map for...of遍历
        const map = observer(
            new Map([
                ["a", 1],
                ["b", 2]
            ])
        );
        const mapResult: [string, number][] = [];
        for (const [key, value] of map) {
            mapResult.push([key, value]);
        }
        expect(mapResult).toEqual([
            ["a", 1],
            ["b", 2]
        ]);
    });

    it("Set/Map should support Symbol.iterator", () => {
        const set = observer(new Set([1, 2, 3]));
        expect(typeof set[Symbol.iterator]).toBe("function");

        const map = observer(new Map([["a", 1]]));
        expect(typeof map[Symbol.iterator]).toBe("function");
    });

    it("Set/Map methods should have stable references (performance optimization)", () => {
        const set = observer(new Set([1, 2, 3]));

        // 验证多次访问同一方法返回相同引用，避免重复创建函数
        const add1 = set.add;
        const add2 = set.add;
        expect(add1).toBe(add2);

        const has1 = set.has;
        const has2 = set.has;
        expect(has1).toBe(has2);

        const delete1 = set.delete;
        const delete2 = set.delete;
        expect(delete1).toBe(delete2);

        const clear1 = set.clear;
        const clear2 = set.clear;
        expect(clear1).toBe(clear2);

        const forEach1 = set.forEach;
        const forEach2 = set.forEach;
        expect(forEach1).toBe(forEach2);

        // 验证Map方法引用稳定性
        const map = observer(new Map([["a", 1]]));

        const set1 = map.set;
        const set2 = map.set;
        expect(set1).toBe(set2);

        const get1 = map.get;
        const get2 = map.get;
        expect(get1).toBe(get2);

        const mapHas1 = map.has;
        const mapHas2 = map.has;
        expect(mapHas1).toBe(mapHas2);

        const mapDelete1 = map.delete;
        const mapDelete2 = map.delete;
        expect(mapDelete1).toBe(mapDelete2);

        const mapClear1 = map.clear;
        const mapClear2 = map.clear;
        expect(mapClear1).toBe(mapClear2);

        const entries1 = map.entries;
        const entries2 = map.entries;
        expect(entries1).toBe(entries2);
    });
});
