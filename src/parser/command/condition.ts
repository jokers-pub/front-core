import { AST } from "@joker.front/ast";
import { IParser } from "../parser";
import { VNode } from "../vnode";
import { isEmptyStr, logger } from "@joker.front/shared";

export class ParserCondition extends IParser<AST.IfCommand, VNode.Condition> {
    /** 缓存当前条件链的下一个条件节点，避免每次遍历next */
    private nextCondition?: VNode.Condition;
    /** 标记是否是else节点 */
    private isElse = false;

    public parser() {
        const node = new VNode.Condition(this.ast.kind, this.parent);
        this.node = node;
        const kind = this.ast.kind;
        this.isElse = kind === "else";

        // 提前缓存下一个条件节点，后续不需要每次遍历
        let next: VNode.Node | undefined = node.next;
        while (next) {
            const curr = next;
            if (!(curr instanceof VNode.Condition) || curr.cmdName === "if") break;
            if (curr.cmdName === "elseif" || curr.cmdName === "else") {
                this.nextCondition = curr;
                break;
            }
            next = curr.next;
        }

        if (!this.isElse) {
            if (isEmptyStr(this.ast.condition)) {
                logger.error(
                    "Conditional Command",
                    `The current conditional command ${kind} has no judgment condition, please check`
                );
            }

            const astCode = this.ast._code;
            const condition = this.ast.condition;
            const ob = this.ob;

            let conditionResult = this.runExpressWithWatcher(
                condition,
                ob,
                (newVal) => {
                    const value = !!newVal;
                    if (node.result === value) return;

                    node.result = value;

                    // 提前销毁不需要的节点，避免无效更新
                    if (value === false) {
                        if (node.isShow) {
                            this.destroyChildrens(true);
                        }
                    } else {
                        // 当前条件为true时，第一时间销毁else节点
                        const elseNode = this.getElseNode();
                        if (elseNode?.isShow && elseNode.childrens?.length) {
                            const parserTarget = elseNode[VNode.PARSERKEY];
                            if (parserTarget instanceof ParserCondition) {
                                parserTarget.renderConditionChildren();
                            }
                        }
                    }

                    this.reloadAllCondition();
                },
                false,
                () => astCode
            );

            //第一次运行完表达式，进行留值存储
            node.result = !!conditionResult;
        }

        this.appendNode();
        this.renderConditionChildren();
    }

    private getElseNode() {
        // 优先用缓存的nextCondition查找
        let nextNode = this.nextCondition || this.node?.next;
        //向上查询，获取级联条件结果
        while (nextNode) {
            if (!(nextNode instanceof VNode.Condition)) break;
            if (nextNode.cmdName === "if") break;

            if (nextNode.cmdName === "else") {
                return nextNode;
            }
            nextNode = nextNode.next;
        }
        return undefined;
    }

    /**
     * 渲染子集
     *
     * @param prevHasTrue 可选参数，标记前面是否已有条件为true，避免重复向上遍历
     * @return 返回当前渲染是否有显示变更
     */
    private renderConditionChildren(prevHasTrue?: boolean) {
        const node = this.node!;

        // 计算新的显示状态：如果传入了前面是否有true的标记就直接用，否则向上查询
        const hasPrevTrue = prevHasTrue ?? this.getPrevIfResult();
        const newShowState = hasPrevTrue ? false : this.isElse ? true : node.result;

        //展示状态发生改变才去触发子节点的创建或销毁
        if (newShowState === node.isShow) {
            return false;
        }

        node.isShow = newShowState;

        //先销毁旧节点，避免重复渲染
        this.destroyChildrens(true);

        if (newShowState && this.ast.childrens) {
            this.ext.parserNodes(this.ast.childrens, node, this.ob);
        }

        return true;
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
        if (!this.isElse && this.ast.kind === "if") {
            return false;
        }

        let prevNode = this.node?.prev;
        //向上查询，获取级联条件结果
        while (prevNode) {
            if (!(prevNode instanceof VNode.Condition)) break;

            // 找到第一个为true的条件直接返回
            if (prevNode.result) {
                return true;
            }

            //遇到if起始节点终止遍历
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
    private reloadAllCondition() {
        /**
         * 当当前值变更后，不需要向上遍历，因为值在读取时已经挂载观察者
         * 观察者响应时按照先后顺序去响应
         * 所以当当前值变更时，之前的条件如果有变动就已经变动完毕
         *
         * 这里只需要向下去重置条件即可
         */

        //执行自己的子集渲染
        const isChange = this.renderConditionChildren();

        /**
         * 如果自己发生变更，则向下传递影响性
         * 若自身无变更，则不向下传递，交由下面的观察者触发
         *
         * 这样可以过滤掉多条件相同观察对象的场景的无效响应
         */
        if (isChange) {
            // 从当前节点的下一个节点开始遍历，确保所有后续条件节点都被处理
            let next = this.node?.next;
            // 标记当前节点是否已经显示，如果当前节点显示，后面的节点都应该隐藏
            let currentShowState = this.node!.isShow;

            //有下一级 && 下一级是条件节点 && 下一级不是if起始
            while (next) {
                if (!(next instanceof VNode.Condition) || next.cmdName === "if") break;

                const parserTarget = next[VNode.PARSERKEY];
                if (parserTarget instanceof ParserCondition) {
                    // 直接传递前面是否有显示的标记，避免每个节点都向上遍历
                    parserTarget.renderConditionChildren(currentShowState);
                    // 如果当前子节点变为显示状态，后面的节点都应该隐藏，更新标记
                    if (next.isShow) {
                        currentShowState = true;
                    }
                }

                next = next.next;
            }
        }
    }
}
