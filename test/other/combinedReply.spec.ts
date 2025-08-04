import { Watcher, combinedReply, observer } from "../../src";

describe("Combined Reply Test", () => {
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

    it("No Combined Reply List", () => {
        listChangeCount = 0;
        state.list.push("1");
        expect(listChangeCount).toEqual(1);
        state.list.push("1");
        expect(listChangeCount).toEqual(2);
    });

    it("No Combined Reply String", () => {
        state.str = "1";
        expect(strChangeCount).toEqual(1);
        //No Change Test
        state.str = "1";
        expect(strChangeCount).toEqual(1);

        state.str = "2";
        expect(strChangeCount).toEqual(2);
    });

    it("Combined Reply List", () => {
        combinedReply(() => {
            state.list.push("1");
            expect(listChangeCount).toEqual(2);
            state.list.push("1");
            expect(listChangeCount).toEqual(2);
        });
        expect(listChangeCount).toEqual(3);
    });

    it("Combined Reply String (No Change)", () => {
        combinedReply(() => {
            state.str = "1";
            expect(strChangeCount).toEqual(2);
            //No Change Test
            state.str = "1";
            expect(strChangeCount).toEqual(2);

            state.str = "2";
            expect(strChangeCount).toEqual(2);
        });
        //The value is 2 and has not changed.
        expect(strChangeCount).toEqual(2);
    });

    it("Combined Reply String (With Changes)", () => {
        combinedReply(() => {
            state.str = "1";
            expect(strChangeCount).toEqual(2);
            //No change test
            state.str = "1";
            expect(strChangeCount).toEqual(2);

            state.str = "3";
            expect(strChangeCount).toEqual(2);
        });
        //The value is 2 and has not changed.
        expect(strChangeCount).toEqual(3);
    });
});
