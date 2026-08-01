import { Watcher, combinedReply, observer } from "../../src";

describe("Combined Reply Multi Dep Test", () => {
    it("多个独立响应式对象，combinedReply修改属性，watcher只触发一次", () => {
        // 模拟三个独立的响应式对象（比如三个不同的props来源）
        const scale = observer({ value: 1 });
        const offsetX = observer({ value: 0 });
        const offsetY = observer({ value: 0 });

        let callbackCount = 0;
        let updateCount = 0;

        const watcher = new Watcher(
            () => [scale.value, offsetX.value, offsetY.value],
            () => {
                callbackCount++;
                console.log("回调执行，次数:", callbackCount);
            }
        );

        // 统计update次数
        const originalUpdate = watcher.update.bind(watcher);
        watcher.update = function () {
            updateCount++;
            console.log("update被调用，次数:", updateCount);
            return originalUpdate();
        };

        console.log("=== 开始测试 ===");
        combinedReply(() => {
            offsetX.value = 100;
            offsetY.value = 200;
            scale.value = 2;
        });
        console.log("=== 测试结束 ===");
        console.log("update总次数:", updateCount, "回调总次数:", callbackCount);

        expect(callbackCount).toBe(1);
        expect(updateCount).toBe(1);
    });
});
