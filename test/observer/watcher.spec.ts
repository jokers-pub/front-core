import { moveUp, remove } from "@joker.front/shared";
import { observer, defineObserverProperty, ShallowObserver } from "../../src/observer/index";
import { Watcher } from "../../src/observer/watcher";

describe("watcher 依赖采集", () => {
    let id = Symbol.for("testid");
    let source = {
        attr: "v1",
        obj: {
            a: "1",
            [id]: "2"
        },
        arry: [1, 2, 3, 4]
    };

    describe("基础", () => {
        let obj = observer(source, true);

        let c1: string = "";
        let w1 = new Watcher(
            obj,
            (val: any) => {
                c1 = val;
            },
            "attr"
        );

        it("变更监听", () => {
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

        it("销毁", () => {
            w1.destroy();
            c1 = "";

            obj.attr = "v3";

            expect(c1).toBe("");
            expect(w1.relations.size).toBe(0);
        });
    });

    describe("数组", () => {
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

        it("观察引用关系", () => {
            expect(watcher.relations.size).toBe(2);
        });

        it("变更", () => {
            obj.arry[2] = 6;
            expect(valueChange === 6 && watcher.value === 6).toBe(true);
        });

        it("增加", () => {
            reset();

            obj.arry.push(5);
            expect(valueChange === undefined && arrChange && lengthChange && watcher.value === 6).toBe(true);
        });

        it("删除", () => {
            reset();

            remove(obj.arry, 2);

            expect(valueChange === 4 && arrChange && lengthChange).toBe(true);
        });

        it("整体变更", () => {
            reset();

            obj.arry = [8, 7, 6, 5, 0, 2];

            expect(valueChange === 6 && arrChange && lengthChange).toBe(true);
        });

        it("特殊语法", () => {
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

        it("特殊场景", () => {
            let arr = observer([]) as number[];

            let isChange = false;
            new Watcher(
                () => [arr[1], arr],
                () => {
                    isChange = true;
                }
            );

            arr[1] = 1;

            //无法监听不存在的属性
            expect(isChange).toBe(false);
        });
    });

    describe("对象", () => {
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

        it("变更", () => {
            obj.obj.a = "2";

            expect(watcher.value === "2" && objChange === false).toBe(true);

            reset();
            obj.obj[id] = "4";
            expect(valueWatch.value === "4" && objChange === true).toBe(true);
        });

        it("增加", () => {
            reset();

            (<any>obj.obj)["b"] = {
                b1: "1"
            };

            expect(objChange).toBe(true);
        });

        it("值替换", () => {
            reset();

            obj.obj = {
                a: "3",
                [id]: "3"
            };

            expect(objChange && watcher.value === "3").toBe(true);
        });

        it("其他", () => {
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

            //新属性
            obj.temp.c = 4;
            expect(changeCount).toBe(1);

            //值不变更不触发
            obj.temp = obj.temp;
            expect(changeCount).toBe(1);
        });
    });

    describe("引用劫持检监测", () => {
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

        it("Dep关系是否复用", () => {
            let watchKeys1 = Array.from(valueWatcher.relations.keys());
            let watchKeys2 = Array.from(valueWatcher2.relations.keys());

            //长度相等，第二位“a“的dep 完全相同，未重复创建
            expect(watchKeys1.length === 2 && watchKeys2.length === 2 && watchKeys1[1] === watchKeys2[1]).toBe(true);
        });

        it("值同步", () => {
            obj.obj.a = "2";

            expect(valueChange && valueChange2 && valueWatcher.value === "2" && valueWatcher2.value === "2").toBe(true);

            reset();

            cloneObj.item.a = "1";
            expect(valueChange && valueChange2 && valueWatcher.value === "1" && valueWatcher2.value === "1").toBe(true);
        });

        it("值替换", () => {
            reset();
            obj.obj = {
                a: "4",
                [id]: "5"
            };

            //clone 的数据属于值替换，上面无监听，所以valueChange2为false
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

    describe("浅劫持观察", () => {
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
