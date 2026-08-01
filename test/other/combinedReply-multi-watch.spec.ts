import { Watcher, combinedReply, observer } from "../../src";

describe("Combined Reply Multi Property Watch Bug Reproduction", () => {
    it("combinedReply中修改多个属性，watcher应该只触发一次", () => {
        const model = observer({
            scale: 1,
            offsetX: 0,
            offsetY: 0
        });

        let callbackCount = 0;
        let updateCount = 0;

        const watcher = new Watcher(
            () => [model.scale, model.offsetX, model.offsetY],
            () => {
                callbackCount++;
                console.log("回调执行，次数:", callbackCount);
                console.trace("回调调用栈");
            }
        );

        // 重写update统计次数
        const originalUpdate = watcher.update.bind(watcher);
        watcher.update = function () {
            updateCount++;
            console.log("update被调用，次数:", updateCount);
            console.trace("update调用栈");
            return originalUpdate();
        };

        console.log("=== 开始测试 ===");
        combinedReply(() => {
            console.log("修改offsetX");
            model.offsetX = 100;
            console.log("修改offsetY");
            model.offsetY = 200;
            console.log("修改scale");
            model.scale = 2;
        });
        console.log("=== 测试结束 ===");
        console.log("update总次数:", updateCount, "回调总次数:", callbackCount);

        expect(callbackCount).toBe(1);
        expect(updateCount).toBe(1);
    });
});
