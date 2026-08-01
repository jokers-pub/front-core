import { AST, EXPRESSHANDLERTAG } from "@joker.front/ast";
import { isPlainObject, foEachProperties } from "@joker.front/shared";
import { defineObserverProperty } from "../../observer";
import { ObType } from "../index";
import { IParser } from "../parser";
import { VNode } from "../vnode";

/**
 * For循环专用表达式运行方法
 */
function createExpress(letKey: string, keyVal: string, condition: string): Function {
    try {
        return new Function(EXPRESSHANDLERTAG, `${EXPRESSHANDLERTAG}.${letKey}=${keyVal}; return ${condition};`);
    } catch {
        throw new Error(
            `Dependency collection for the For loop command expression execution encountered an unknown error. Details: letKey: ${letKey}, keyVal: ${keyVal}, condition: ${condition}`
        );
    }
}

export class ParserList extends IParser<AST.ForCommand, VNode.List> {
    public parser() {
        this.node = new VNode.List(this.parent);
        this.appendNode();
        this.renderChildrens();
    }

    private renderChildrens() {
        switch (this.ast.keyType) {
            case "condition":
                this.renderConditionChildrens();
                break;
            case "in":
            case "of":
                this.renderInOrOfChildrens();
                break;
        }
    }

    private renderConditionChildrens() {
        let param = this.ast.param as AST.ConditionParam;

        let forOb = Object.create(this.ob);

        /**
         * 此处采用自定义表达式方法目的是：
         *
         * 此处存在两个依赖采集点，分别是：defaultKeyVal和condition
         * 这两个采集点可能存在依赖点重叠，如果重叠则会造成重复遍历
         * 为了解决此问题，将创建一个复合表达式，对齐进行统一采集
         *
         * 该方法会设置一次默认值，并且返回首次的判断结果
         */
        let breakVal = !!this.runExpressWithWatcher(
            createExpress(param.letKey, param.defaultKeyVal, param.condition),
            forOb,
            () => {
                //每次都需要重新观察
                this.clearWatchers();
                this.renderChildrens();
            },
            true,
            () => {
                return this.ast._code;
            }
        );

        let index = 0;

        while (breakVal) {
            //每次都要创新新的对象，因为对象是引用类型，不可以公用一个对象传递
            //如果挂载的新属性都是作为渲染，则可以用同一个属性传递
            //但是我们的属性可能会存在于一些延时触发的事件中
            let stepOb = Object.create(this.ob);

            //设置数据劫持属性
            defineObserverProperty(stepOb, param.letKey, forOb[param.letKey]);

            let currentIndex = index++;

            this.renderItem(stepOb, currentIndex);

            this.runExpressWithWatcher(
                () => forOb[param.letKey],
                forOb,
                async (newVal, _, isEqual, watcher) => {
                    //做一次等待，防止后续长度变更带来的二次更新
                    await Promise.resolve();
                    if (watcher.isDestroy) return;

                    stepOb[param.letKey!] = newVal;
                    if (!isEqual) {
                        this.updateListItemOb(stepOb, currentIndex);
                    }
                },
                true,
                () => this.ast._code
            );

            //执行下一次循环设值
            this.runExpress(param.step, forOb, () => {
                this.ast._code;
            });
            //读取下一次的判断条件
            breakVal = !!this.runExpress(param.condition, forOb, () => this.ast._code);
        }

        this.destroyOldChildrens(index);
    }

    private renderInOrOfChildrens() {
        let param = this.ast.param as AST.InOrOfParam;

        let listOb = this.runExpressWithWatcher(
            param.dataKey,
            this.ob,
            () => {
                //每次都需要重新观察
                this.clearWatchers();
                this.renderChildrens();
            },
            false,
            () => {
                return this.ast._code;
            }
        );

        let index = 0;

        if (listOb) {
            const isArray = Array.isArray(listOb);
            // 提前判断是否是可遍历类型，避免循环内重复判断
            if (isArray || isPlainObject(listOb)) {
                const hasIndexKey = !!param.indexKey;
                const hasItemKey = !!param.itemKey;
                const itemKey = param.itemKey;
                const indexKey = param.indexKey;
                const astCode = this.ast._code;

                for (let key in listOb) {
                    let stepOb = Object.create(this.ob);
                    let keyVal = isArray ? Number(key) : key;
                    //对于数组时，index为索引，对于对象index为key（统称索引Key）
                    if (hasIndexKey) {
                        defineObserverProperty(stepOb, indexKey!, keyVal);
                    }

                    const itemVal = listOb[key];
                    if (hasItemKey) {
                        defineObserverProperty(stepOb, itemKey!, itemVal);
                    }
                    let currentIndex = index++;

                    this.renderItem(stepOb, currentIndex, indexKey, itemKey);

                    if (hasItemKey) {
                        this.runExpressWithWatcher(
                            //@ts-ignore
                            () => listOb[keyVal],
                            listOb,
                            async (newVal, _, isEqual, watcher) => {
                                //做一次等待，防止后续长度变更带来的二次更新
                                await Promise.resolve();
                                if (watcher.isDestroy) return;

                                if (keyVal in listOb) {
                                    stepOb[itemKey!] = newVal;
                                    if (!isEqual) {
                                        this.updateListItemOb(stepOb, currentIndex, itemKey);
                                    }
                                }
                            },
                            true,
                            () => astCode
                        );
                    }
                }
            }
        }
        this.destroyOldChildrens(index);
    }

    findIndexByIndex(ob: ObType, startIndex: number, indexKey?: string, itemKey?: string) {
        if (!this.node) return -1;

        const childrens = this.node.childrens;
        // 优先比较item值（item才是内容标识，index只是位置）
        if (itemKey) {
            const targetItemVal = ob[itemKey];
            for (let i = startIndex, len = childrens.length; i < len; i++) {
                const child = childrens[i];
                if (child && child.ob[itemKey] === targetItemVal) {
                    return i;
                }
            }
            return -1;
        }

        // 条件循环（for i from x to y）只有一个循环变量，直接比较
        const letKey = (this.ast.param as AST.ConditionParam).letKey;
        if (letKey) {
            const targetVal = ob[letKey];
            for (let i = startIndex, len = childrens.length; i < len; i++) {
                const child = childrens[i];
                if (child && child.ob[letKey] === targetVal) {
                    return i;
                }
            }
        }

        return -1;
    }

    /**
     * 渲染循环项
     * @param ob
     * @param index
     */
    private renderItem(ob: ObType, index: number, indexKey?: string, itemKey?: string): any {
        if (!this.ast.childrens?.length || !this.node) {
            return;
        }

        let stepList = this.node.childrens[index];

        //若已经存在，则响应变更
        if (stepList) {
            const stepOb = stepList.ob;
            let isEqual = true;

            // 直接比较固定属性，不需要通用遍历：item是内容标识，优先比较
            if (itemKey) {
                if (stepOb[itemKey] !== ob[itemKey]) isEqual = false;
            } else {
                // 条件循环场景
                const letKey = (this.ast.param as AST.ConditionParam).letKey;
                if (stepOb[letKey] !== ob[letKey]) isEqual = false;
            }

            if (isEqual) {
                // 是同一个节点，同步index（如果有变化）
                if (indexKey && stepOb[indexKey] !== ob[indexKey]) {
                    stepOb[indexKey] = ob[indexKey];
                }
                return;
            }

            let nextIndex = this.findIndexByIndex(ob, index + 1, indexKey, itemKey);

            if (nextIndex > -1) {
                //删除中间多余的节点
                const deleteCount = nextIndex - index;
                for (let i = 0; i < deleteCount; i++) {
                    this.node.childrens[index]?.[VNode.PARSERKEY]?.destroy();
                }

                return this.renderItem(ob, index, indexKey, itemKey);
            } else {
                //新增
                return new ParserListeItem(this.ast, ob, this.node!, this.ext).init(index);
            }
        } else {
            return new ParserListeItem(this.ast, ob, this.node!, this.ext).init();
        }
    }

    private updateListItemOb(ob: any, index: number, itemKey?: string) {
        const childrens = this.node?.childrens;
        if (!this.ast.childrens?.length || !childrens || index >= childrens.length) {
            return;
        }

        const stepOb = childrens[index]?.ob;
        if (!stepOb) return;

        // 直接更新固定属性，不需要遍历
        if (itemKey) {
            const newVal = ob[itemKey];
            if (stepOb[itemKey] !== newVal) {
                stepOb[itemKey] = newVal;
            }
        } else {
            // 条件循环场景
            const letKey = (this.ast.param as AST.ConditionParam).letKey;
            const newVal = ob[letKey];
            if (stepOb[letKey] !== newVal) {
                stepOb[letKey] = newVal;
            }
        }
    }
    /**
     * 销毁历史遗留多余的节点
     * @param index
     */
    private destroyOldChildrens(index: number) {
        if (!this.node) return;
        const childrens = this.node.childrens;
        while (childrens.length > index) {
            let item = childrens.pop();

            if (item) {
                // 维护prev/next指针
                if (childrens.length > 0) {
                    childrens[childrens.length - 1].next = undefined;
                }
                item[VNode.PARSERKEY]?.destroy(false);
            } else {
                break;
            }
        }
    }
}

export class ParserListeItem extends IParser<AST.ForCommand, VNode.ListItem> {
    public parser(index?: number) {
        this.node = new VNode.ListItem(this.ob, this.parent);

        this.appendNode(index);

        this.ast.childrens && this.ext.parserNodes(this.ast.childrens, this.node, this.ob);
    }
}
