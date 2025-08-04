import {
    defineObserverProperty,
    isObserverData,
    OBJECTPROXY_DEPID,
    observer,
    ShallowObserver
} from "../../src/observer";

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
});
