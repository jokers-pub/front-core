import { moveUp, remove } from "@joker.front/shared";
import { observer, defineObserverProperty, ShallowObserver } from "../../src/observer/index";
import { Watcher } from "../../src/observer/watcher";

describe("Watcher Dependency Collection", () => {
    let id = Symbol.for("testid");
    let source = {
        attr: "v1",
        obj: {
            a: "1",
            [id]: "2"
        },
        arry: [1, 2, 3, 4]
    };

    describe("Basic", () => {
        let obj = observer(source, true);

        let c1: string = "";
        let w1 = new Watcher(
            obj,
            (val: any) => {
                c1 = val;
            },
            "attr"
        );

        it("Change Detection", () => {
            expect(w1.value).toEqual("v1");

            let c2: string = "";
            let w2 = new Watcher(
                obj,
                (val: any) => {
                    c2 = val;
                },
                "obj.a"
            );

            expect(w2.value).toEqual("1");

            let c3: number | undefined;
            let w3 = new Watcher(
                obj,
                (val: any) => {
                    c3 = val;
                },
                "arry.2"
            );

            expect(w3.value).toEqual(3);

            obj.attr = "v2";
            obj.obj.a = "2";
            obj.arry[2] = 4;

            expect(c1 === "v2" && c2 === "2" && c3 === 4).toBe(true);
        });

        it("Destroy", () => {
            w1.destroy();
            c1 = "";

            obj.attr = "v3";

            expect(c1).toBe("");
            expect(w1.relations.size).toBe(0);
        });
    });

    describe("Array", () => {
        let obj = observer(source, true);

        let valueChange: number | undefined;
        let arrChange = false;
        let lengthChange = false;

        let watcher = new Watcher(
            obj,
            (val: any) => {
                valueChange = val;
            },
            "arry.2"
        );
        new Watcher(
            obj,
            (val: any) => {
                arrChange = true;
            },
            "arry"
        );
        new Watcher(
            obj,
            (val: any) => {
                lengthChange = true;
            },
            "arry.length"
        );

        function reset() {
            valueChange = undefined;
            arrChange = false;
            lengthChange = false;
        }

        it("Observe Reference Relationships", () => {
            expect(watcher.relations.size).toBe(2);
        });

        it("Modification", () => {
            obj.arry[2] = 6;
            expect(valueChange === 6 && watcher.value === 6).toBe(true);
        });

        it("Addition", () => {
            reset();

            obj.arry.push(5);
            expect(valueChange === undefined && arrChange && lengthChange && watcher.value === 6).toBe(true);
        });

        it("Deletion", () => {
            reset();

            remove(obj.arry, 2);

            expect(valueChange === 4 && arrChange && lengthChange).toBe(true);
        });

        it("Overall change", () => {
            reset();

            obj.arry = [8, 7, 6, 5, 0, 2];

            expect(valueChange === 6 && arrChange && lengthChange).toBe(true);
        });

        it("Special Grammar", () => {
            reset();
            obj.arry.unshift(9);
            expect(valueChange === 7 && arrChange && lengthChange).toBe(true);

            reset();
            obj.arry.shift();
            expect(valueChange === 6 && arrChange && lengthChange).toBe(true);

            reset();
            obj.arry.length = 3;
            expect(valueChange === undefined && arrChange && lengthChange).toBe(true);

            reset();
            moveUp(obj.arry, 1);
            expect(valueChange === undefined && !arrChange && !lengthChange).toBe(true);
        });

        it("Special Scenarios", () => {
            let arr = observer([]) as number[];

            let isChange = false;
            new Watcher(
                () => [arr[1], arr],
                () => {
                    isChange = true;
                }
            );

            arr[1] = 1;

            // Cannot observe non-existent properties
            expect(isChange).toBe(false);
        });
    });

    describe("Object", () => {
        let obj = observer(source, true);
        let objChange = false;

        let watcher = new Watcher(obj, () => {}, "obj.a");

        let objWatcher = new Watcher(
            obj,
            (val: any) => {
                objChange = true;
            },
            "obj"
        );

        let valueWatch = new Watcher(
            obj,
            () => {},
            function (data) {
                return data.obj[id];
            }
        );

        function reset() {
            objChange = false;
        }

        it("Modification", () => {
            obj.obj.a = "2";

            expect(watcher.value === "2" && objChange === false).toBe(true);

            reset();
            obj.obj[id] = "4";
            expect(valueWatch.value === "4" && objChange === true).toBe(true);
        });

        it("Addition", () => {
            reset();

            (<any>obj.obj)["b"] = {
                b1: "1"
            };

            expect(objChange).toBe(true);
        });

        it("Value Replacement", () => {
            reset();

            obj.obj = {
                a: "3",
                [id]: "3"
            };

            expect(objChange && watcher.value === "3").toBe(true);
        });

        it("Others", () => {
            let obj = observer(
                {
                    temp: {
                        a: 1,
                        b: 2
                    } as any
                },
                true
            );
            let changeCount = 0;

            let watcher = new Watcher(
                () => obj.temp,
                () => {
                    changeCount++;
                }
            );

            obj.temp ??= {};

            expect(changeCount).toBe(0);

            obj.temp.a = 3;
            expect(changeCount).toBe(0);

            //New attribute
            obj.temp.c = 4;
            expect(changeCount).toBe(1);

            //No trigger if the value remains unchanged
            obj.temp = obj.temp;
            expect(changeCount).toBe(1);
        });
    });

    describe("Advanced Types of Set", () => {
        let obj = observer({
            v: new Set<any>()
        });
        let objChange = false;

        new Watcher(
            () => obj.v,
            () => {
                objChange = true;
            }
        );

        obj.v.add("1");
        expect(objChange).toBe(true);

        objChange = false;
        obj.v.delete("1");
        expect(objChange).toBe(true);

        obj.v.add("1");
        objChange = false;
        obj.v.clear();
        expect(objChange).toBe(true);

        //Testing setting values will also cause data hijacking.
        objChange = false;
        let obj1 = {
            name: "1"
        };

        obj.v.add(obj1);
        new Watcher(
            () => obj1.name,
            () => {
                objChange = true;
            }
        );

        obj1.name = "3";
        expect(objChange).toBe(true);
    });

    describe("Advanced Types of Map", () => {
        let obj = observer({
            v: new Map<string, any>()
        });
        let objChange = false;

        new Watcher(
            () => obj.v,
            () => {
                objChange = true;
            }
        );

        obj.v.set("1", "1");
        expect(objChange).toBe(true);

        objChange = false;
        obj.v.delete("1");
        expect(objChange).toBe(true);

        obj.v.set("1", "1");
        objChange = false;
        obj.v.clear();
        expect(objChange).toBe(true);

        //Testing value assignment will also lead to data hijacking.
        objChange = false;
        let obj1 = {
            name: "1"
        };

        obj.v.set("1", obj1);
        new Watcher(
            () => obj1.name,
            () => {
                objChange = true;
            }
        );

        obj1.name = "3";
        expect(objChange).toBe(true);
    });

    describe("Reference Hijacking Detection and Monitoring", () => {
        let obj = observer(source, true);
        let valueChange = false;
        let objChange = false;
        let objChangeCount = 0;

        let valueWatcher = new Watcher(
            obj,
            () => {
                valueChange = true;
            },
            "obj.a"
        );

        new Watcher(
            obj,
            () => {
                objChange = true;
                objChangeCount++;
            },
            "obj"
        );

        let cloneObj = Object.create(obj);

        defineObserverProperty(cloneObj, "item", obj.obj);

        let valueChange2 = false;
        let objChange2 = false;
        let valueWatcher2 = new Watcher(
            cloneObj,
            () => {
                valueChange2 = true;
            },
            "item.a"
        );

        new Watcher(
            cloneObj,
            () => {
                objChange2 = true;
            },
            "item"
        );

        function reset() {
            valueChange = false;
            valueChange2 = false;
            objChange = false;
            objChange2 = false;
            objChangeCount = 0;
        }

        it("Whether to reuse dependency relationships", () => {
            let watchKeys1 = Array.from(valueWatcher.relations.keys());
            let watchKeys2 = Array.from(valueWatcher2.relations.keys());

            //The lengths are equal, and the "dep" of the second "a" is completely the same, with no duplicate creation.
            expect(watchKeys1.length === 2 && watchKeys2.length === 2 && watchKeys1[1] === watchKeys2[1]).toBe(true);
        });

        it("Value Synchronization", () => {
            obj.obj.a = "2";

            expect(valueChange && valueChange2 && valueWatcher.value === "2" && valueWatcher2.value === "2").toBe(true);

            reset();

            cloneObj.item.a = "1";
            expect(valueChange && valueChange2 && valueWatcher.value === "1" && valueWatcher2.value === "1").toBe(true);
        });

        it("Value Replacement", () => {
            reset();
            obj.obj = {
                a: "4",
                [id]: "5"
            };

            //The cloned data is a value replacement, and there is no monitoring on it, so valueChange2 is false.
            expect(
                objChangeCount === 1 &&
                    valueChange &&
                    valueChange2 === false &&
                    valueWatcher.value === "4" &&
                    valueWatcher2.value === "1" &&
                    objChange &&
                    objChange2 === false
            ).toBe(true);
        });
    });

    describe("Shallow Proxy Observation", () => {
        let target = new ShallowObserver({ a: 1 });

        let isChanged = false;
        new Watcher(
            () => target.value,
            () => {
                isChanged = true;
            }
        );

        target.value.a = 2;
        expect(isChanged).toBe(false);

        target.value = { a: 2 };
        expect(isChanged).toBe(false);

        target.value = { a: 3 };
        expect(isChanged).toBe(true);
    });
});
