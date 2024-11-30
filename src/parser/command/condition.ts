import { AST } from "@joker.front/ast";
import { IParser } from "../parser";
import { VNode } from "../vnode";
import { guid, isEmptyStr, logger } from "@joker.front/shared";

export class ParserCondition extends IParser<AST.IfCommand, VNode.Condition> {
    public async parser() {
        this.node = new VNode.Condition(this.ast.kind, this.parent);

        if (this.ast.kind !== "else") {
            if (isEmptyStr(this.ast.condition)) {
                logger.error("条件命令", `当前条件命令${this.ast.kind}没有判断条件，请检查`);
            }

            let conditionResult = this.runExpressWithWatcher(this.ast.condition, this.ob, (newVal) => {
                let value = !!newVal;
                if (this.node?.result !== value) {
                    this.node!.result = value;

                    this.renderId = guid();
                    this.reloadAllCondition(this.renderId);
                }
            });

            //第一次运行完表达式，进行留值存储
            this.node.result = !!conditionResult;
        }

        this.appendNode();

        this.renderId = guid();
        await this.renderConditionChildren();
    }

    renderId?: string;

    /**
     * 渲染子集
     *
     * @return 返回当前渲染是否有显示变更
     */
    private async renderConditionChildren() {
        let newShowState = false;
        let prevResult = this.getPrevIfResult();

        if (prevResult) {
            newShowState = false;
        } else if (this.ast.kind === "else") {
            newShowState = true;
        } else {
            //刷新一次result
            this.node!.result = !!this.runExpress(this.ast.condition, this.ob);
            if (this.node!.result) {
                newShowState = true;
            }
        }

        //展示状态发生改变才去触发子节点的创建或销毁
        if (newShowState !== this.node!.isShow) {
            this.node!.isShow = newShowState;

            //先去触发一次销毁，避免同一个条件 被多次渲染 同为true 时，可能会被多次渲染
            this.destroyChildrens(true);

            if (newShowState) {
                if (this.ast.childrens) {
                    await this.ext.parserNodes(this.ast.childrens, this.node!, this.ob);
                }
            }

            return true;
        }

        return false;
    }

    /**
     * 获取同级前面的判断条件结果，如果有一个true则返回true，
     * 否则认为上面所有条件判断都为false
     * @returns
     */
    private getPrevIfResult(): boolean {
        /**
         * 由于页面AST的解析及装载顺序是从上向下的
         * 所以，当运行到此节点时，👆面的条件已全部完成运行，并返回了结果
         */

        //如果当前节点就是if则算上面（虚拟条件为false）
        if (this.ast.kind === "if") {
            return false;
        }

        let prevNode = this.node?.prev;
        //向上查询，获取级联条件结果
        while (prevNode && prevNode instanceof VNode.Condition) {
            if (prevNode.result) {
                return true;
            }

            //避免相邻之间互相影响
            if (prevNode.cmdName === "if") {
                break;
            }

            prevNode = prevNode.prev;
        }

        return false;
    }

    /**
     * 重载所有的判断（从上到下）
     */
    private async reloadAllCondition(renderId: string) {
        /**
         * 当当前值变更后，不需要向上遍历，因为值在读取时已经挂载观察者
         * 观察者响应时按照先后顺序去响应
         * 所以当当前值变更时，之前的条件如果有变动就已经变动完毕
         *
         * 这里只需要向下去重置条件即可
         */

        //执行自己的子集渲染
        let isChange = await this.renderConditionChildren();

        /**
         * 如果自己发生变更，则向下传递影响性
         * 若自身无变更，则不向下传递，交由下面的观察者触发
         *
         * 这样可以过滤掉多条件相同观察对象的场景的无效响应
         *
         * 例如：
         * @if(a ===1){
         * }
         * else if(a===2){
         * }
         * else if(true){
         * }
         *
         * 若a从3变更到1时
         * 第一个if发生变更向下传递所有变更影响
         * 这时else if(a===2) 也收到变更通知， 这时发现自身展示状态无变更，则不向下传递影响
         */
        if (isChange && renderId === this.renderId) {
            let next = this.node?.next;

            //有下一级 && 下一级是条件节点 && 下一级不是if起始
            while (next && next instanceof VNode.Condition && next.cmdName !== "if") {
                let parserTarget = next[VNode.PARSERKEY];

                if (parserTarget && parserTarget instanceof ParserCondition) {
                    parserTarget.renderId = guid();
                    await parserTarget.renderConditionChildren();

                    if (renderId !== this.renderId) return;
                }

                next = next.next;
            }
        }

        if (renderId === this.renderId) {
            let next = this.node?.next;
            if (!this.node?.result) {
                this.destroyChildrens(true);
            }
            //有下一级 && 下一级是条件节点 && 下一级不是if起始
            while (next && next instanceof VNode.Condition && next.cmdName !== "if") {
                let parserTarget = next[VNode.PARSERKEY];

                if (parserTarget && parserTarget instanceof ParserCondition) {
                    //做一次清理补偿
                    if (!parserTarget.node?.isShow) {
                        parserTarget.destroyChildrens(true);
                    }
                }

                next = next.next;
            }
        }
    }
}
