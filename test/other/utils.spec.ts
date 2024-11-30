import { resolveDeepPromisesInPlace } from "../../src/utils/index";

describe("工具类", () => {
    it("深度Promise解析", async () => {
        // 非Promise;
        expect(resolveDeepPromisesInPlace(1)).toEqual(1);
        expect(resolveDeepPromisesInPlace([])).toEqual([]);
        expect(resolveDeepPromisesInPlace({})).toEqual({});

        expect(resolveDeepPromisesInPlace([1, 2, 3, 5, { a: 1, b: { c: 3 } }])).toEqual([
            1,
            2,
            3,
            5,
            { a: 1, b: { c: 3 } }
        ]);
        expect(resolveDeepPromisesInPlace({ a: 1, b: { c: 3 }, d: [1, 3, 45, { e: 1 }] })).toEqual({
            a: 1,
            b: { c: 3 },
            d: [1, 3, 45, { e: 1 }]
        });

        //存在
        let value = resolveDeepPromisesInPlace(Promise.resolve(3));
        expect(value instanceof Promise).toEqual(true);

        let result = await value;
        expect(result).toEqual(3);

        value = resolveDeepPromisesInPlace({
            a: 1,
            b: Promise.resolve(3)
        });
        expect(value instanceof Promise).toEqual(true);

        result = await value;
        expect(result).toEqual({ a: 1, b: 3 });

        value = resolveDeepPromisesInPlace(
            {
                a: 1,
                b: [Promise.resolve(3), 3, { c: 4, d: Promise.resolve(4) }],
                c: Promise.resolve(8)
            },
            true
        );

        expect(value instanceof Promise).toEqual(true);

        result = await value;
        expect(result).toEqual({ a: 1, b: [3, 3, { c: 4, d: 4 }], c: 8 });
    });
});
