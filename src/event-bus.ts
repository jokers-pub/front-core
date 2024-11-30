import { remove } from "@joker.front/shared";

export type EventCallBackItem<T> = {
    callBack: EventCallBackType<T>;
    once?: Boolean;
};

export type EventCallBackType<T> = (
    e: {
        eventName: string | number | Symbol;
        stopPropagation: Function;
        callTimes: Number;
    },
    params: T
) => boolean | void | Promise<boolean | void>;

export class EventBus<T extends Record<string, any>> {
    private eventDatas: Map<keyof T, EventCallBackItem<any>[]> = new Map();

    /**
     * 注册事件
     * @param eventName
     * @param callBack
     * @returns 事件销毁
     */
    public on<K extends keyof T>(eventName: K | "*", callBack: EventCallBackType<T[K]>) {
        let callbacks = this.eventDatas.get(eventName);

        if (callbacks === undefined) {
            callbacks = [];
            this.eventDatas.set(eventName, callbacks);
        }

        let newItem = { callBack };
        callbacks.push(newItem);

        return () => {
            callbacks && remove(callbacks, newItem);
        };
    }

    /**
     * 注册一次性事件（指触发一次）
     * @param eventName
     * @param callBack
     * @returns 事件销毁
     */
    public once<K extends keyof T>(eventName: K, callBack: EventCallBackType<T[K]>) {
        let callbacks = this.eventDatas.get(eventName);

        if (callbacks === undefined) {
            callbacks = [];
            this.eventDatas.set(eventName, callbacks);
        }

        let newItem = { callBack, once: true };
        callbacks.push(newItem);
        return () => {
            callbacks && remove(callbacks, newItem);
        };
    }

    /**
     * 销毁事件
     * @param eventName
     * @param callBack
     * @returns
     */
    public off<K extends keyof T>(eventName?: K, callBack?: EventCallBackType<T[K]>) {
        if (eventName === undefined) {
            this.eventDatas.clear();
            return;
        }
        if (callBack) {
            let callBacks = this.eventDatas.get(eventName);

            let removeItem = callBacks?.find((m) => m.callBack === callBack);

            removeItem && remove(callBacks!, removeItem);
        } else {
            // off all
            this.eventDatas.delete(eventName);
        }
    }

    /**
     * 触发事件
     * @param eventName
     * @param param
     * @returns
     */
    public async trigger<K extends keyof T>(eventName: K, param?: T[K]) {
        let callBacks = [...(this.eventDatas.get(eventName) || [])];

        callBacks.push(...(this.eventDatas.get("*") || []));

        if (callBacks && callBacks.length) {
            let i = 0,
                callTimes = 0,
                isBreak = false;
            while (callBacks[i]) {
                let item = callBacks[i];
                let result = await item.callBack(
                    {
                        stopPropagation: () => (isBreak = true),
                        callTimes,
                        eventName
                    },
                    param
                );

                if (item.once) {
                    remove(callBacks, item);
                } else {
                    i++;
                }

                if (result === false || isBreak) {
                    return false;
                }
            }
        }
    }
}
