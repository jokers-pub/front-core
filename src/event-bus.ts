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
     * Register an event
     * @param eventName Event name
     * @param callBack Callback function
     * @returns Event destruction function
     */
    public on<K extends keyof T>(eventName: K | "*", callBack: EventCallBackType<T[K]>) {
        let callbacks = this.eventDatas.get(eventName);

        if (callbacks === undefined) {
            callbacks = [];
            this.eventDatas.set(eventName, callbacks);
        }

        const newItem = { callBack };
        callbacks.push(newItem);

        return () => {
            callbacks && remove(callbacks, newItem);
        };
    }

    /**
     * Register a one-time event (triggers once)
     * @param eventName Event name
     * @param callBack Callback function
     * @returns Event destruction function
     */
    public once<K extends keyof T>(eventName: K, callBack: EventCallBackType<T[K]>) {
        let callbacks = this.eventDatas.get(eventName);

        if (callbacks === undefined) {
            callbacks = [];
            this.eventDatas.set(eventName, callbacks);
        }

        const newItem = { callBack, once: true };
        callbacks.push(newItem);
        return () => {
            callbacks && remove(callbacks, newItem);
        };
    }

    /**
     * Remove event listeners
     * @param eventName Event name (optional)
     * @param callBack Specific callback to remove (optional)
     */
    public off<K extends keyof T>(eventName?: K, callBack?: EventCallBackType<T[K]>) {
        if (eventName === undefined) {
            this.eventDatas.clear();
            return;
        }
        if (callBack) {
            const callbacks = this.eventDatas.get(eventName);
            const removeItem = callbacks?.find((m) => m.callBack === callBack);
            removeItem && remove(callbacks!, removeItem);
        } else {
            // Remove all listeners for the event
            this.eventDatas.delete(eventName);
        }
    }

    /**
     * Trigger an event
     * @param eventName Event name
     * @param param Event parameter
     * @returns Whether the event was stopped (`false` if stopped)
     */
    public async trigger<K extends keyof T>(eventName: K, param?: T[K]) {
        let callbacks = [...(this.eventDatas.get(eventName) || [])];
        callbacks.push(...(this.eventDatas.get("*") || []));

        if (callbacks && callbacks.length) {
            let i = 0,
                callTimes = 0,
                isBreak = false;
            while (callbacks[i]) {
                const item = callbacks[i];
                const result = await item.callBack(
                    {
                        stopPropagation: () => (isBreak = true),
                        callTimes,
                        eventName
                    },
                    param
                );

                if (item.once) {
                    remove(callbacks, item);
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
