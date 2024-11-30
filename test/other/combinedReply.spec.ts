import { Watcher, combinedReply, observer } from "../../src";

describe("组合回复测试", () => {
    let state = observer<{
        list: string[];
        str: string;
    }>({ list: [], str: "" });

    let listChangeCount = 0;
    let strChangeCount = 0;

    new Watcher(
        () => state.list,
        () => {
            listChangeCount++;
        }
    );

    new Watcher(
        () => state.str,
        () => {
            strChangeCount++;
        }
    );

    it("无组合回复-list", () => {
        listChangeCount = 0;
        state.list.push("1");
        expect(listChangeCount).toEqual(1);
        state.list.push("1");
        expect(listChangeCount).toEqual(2);
    });

    it("无组合回复-str", () => {
        state.str = "1";
        expect(strChangeCount).toEqual(1);
        //无变动测试
        state.str = "1";
        expect(strChangeCount).toEqual(1);

        state.str = "2";
        expect(strChangeCount).toEqual(2);
    });

    it("组合回复-list", () => {
        combinedReply(() => {
            state.list.push("1");
            expect(listChangeCount).toEqual(2);
            state.list.push("1");
            expect(listChangeCount).toEqual(2);
        });
        expect(listChangeCount).toEqual(3);
    });

    it("组合回复-str（无变更）", () => {
        combinedReply(() => {
            state.str = "1";
            expect(strChangeCount).toEqual(2);
            //无变动测试
            state.str = "1";
            expect(strChangeCount).toEqual(2);

            state.str = "2";
            expect(strChangeCount).toEqual(2);
        });
        //值是2未变更
        expect(strChangeCount).toEqual(2);
    });

    it("组合回复-str（变更）", () => {
        combinedReply(() => {
            state.str = "1";
            expect(strChangeCount).toEqual(2);
            //无变动测试
            state.str = "1";
            expect(strChangeCount).toEqual(2);

            state.str = "3";
            expect(strChangeCount).toEqual(2);
        });
        //值是2未变更
        expect(strChangeCount).toEqual(3);
    });
});
