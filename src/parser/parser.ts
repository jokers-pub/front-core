import { AST, EXPRESSHANDLERTAG } from "@joker.front/ast";
import { logger, remove } from "@joker.front/shared";
import { ObType, ParserTemplate, NodeChangeType } from ".";
import { IS_DESTROY, SCOPE_ID } from "../index";
import { __GLONAL_FUNTIONS__ } from "../global";
import { BREAK_WATCH_UPDATE, Watcher } from "../observer/watcher";
import { VNode } from "./vnode";

export const GLOBAL_TAG = "Global";
const LOGTAG = "渲染核心";
/**
 * 创建表达式运行方法
 * @param express 表达式字符串（依赖AST转换，自带参数文根）
 * @returns
 */
function createExpress(express: string): Function {
    try {
        return new Function(EXPRESSHANDLERTAG, GLOBAL_TAG, `return ${express};`);
    } catch {
        throw new Error(`创建表达式运行方法时出现未知错误，表达式为` + express);
    }
}

export abstract class IParser<T extends AST.Node, N extends VNode.Node> {
    /** 当前转换节点ref标记 */
    public ref: string = "";
    /** 当前AST解析 所产生的观察者 */
    private watchers: Watcher<any>[] = [];

    public node?: N;

    isDestroy = false;
    constructor(
        /** ast集合 */
        protected ast: T,
        /** 数据源 会在component上进行属性新增 */
        public ob: ObType,
        /** 父节点 */
        protected parent: VNode.Node,
        /** 外部处理（ParserTemplate） */
        protected ext: ParserTemplate
    ) {}

    init(index?: number) {
        let promise = this.parser(index);

        this.afterParser();

        if (promise) return promise;
    }

    /**
     * 上游主入口方法（初始化执行）
     */
    public abstract parser(index?: number): void | Promise<void>;

    protected beforeDestroy(keepalive?: boolean): void | boolean {}

    /**
     * 销毁流程
     */
    public destroy(keepalive?: boolean) {
        this.isDestroy = true;
        //优先移除watcher关系
        this.clearWatchers();

        if (this.parent.childrens && this.node) {
            if (this.node instanceof VNode.Element || this.node instanceof VNode.Component) {
                //如果是Element 或者 组件节点（只有这些类型可以配置ref）

                this.ext.removeRef(this.node);
            }

            let removeNode = () => {
                if (this.parent && this.node) {
                    this.beforeDestroy(keepalive);

                    this.destroyChildrens(keepalive);

                    //remove 应该按照append倒序执行
                    this.ext.render?.removeNode(this.node);

                    this.parent.childrens && remove(this.parent.childrens, this.node);

                    //通知放最后
                    this.notifyNodeWatcher("remove");

                    this.destroyOtherData();
                }
            };

            //如果有动画
            if (
                this.ext.nodeTransition(this.node, "leave", undefined, () => {
                    removeNode();
                })
            ) {
                //先解除层级关系，不阻塞其余节点正常卸载
                remove(this.parent.childrens, this.node);

                //消除所有子集的watcher监听
                this.destroyChildrensWatcher(this.node);
                return;
            }

            removeNode();
        } else {
            this.destroyOtherData();
        }
    }

    public destroyWathcers() {
        this.isDestroy = true;
        this.clearWatchers();
        //消除所有子集的watcher监听
        this.destroyChildrensWatcher(this.node);
    }

    private destroyOtherData() {
        this.node && (this.node[VNode.PARSERKEY] = undefined);

        this.node = undefined;

        this.parent = <any>undefined;
    }

    /**
     * 销毁所有子集VNode
     */
    public destroyChildrens(keepalive?: boolean) {
        while (this.node?.childrens?.length) {
            let item = this.node.childrens[0];
            if (item[VNode.PARSERKEY]) {
                item[VNode.PARSERKEY].destroy(keepalive);
            } else {
                //root 类型 ，不做销毁，只是做数组移除，销毁已处理
                remove(this.node.childrens, item);
            }
        }
    }

    /**
     * 销毁所有子集VNode的watcher，为了防止延迟卸载时，无效通知广播
     */
    protected destroyChildrensWatcher(nodeItem?: VNode.Node) {
        if (nodeItem?.childrens?.length) {
            for (let node of nodeItem?.childrens) {
                if (node[VNode.PARSERKEY]) {
                    node[VNode.PARSERKEY].clearWatchers();

                    this.destroyChildrensWatcher(node);
                }
            }
        }
    }

    /**
     * 插入自身节点
     */
    protected appendNode(index?: number) {
        if (this.parent?.childrens && this.node && !this.isDestroy) {
            this.node[VNode.PARSERKEY] = this;

            if (this.node instanceof VNode.Element && this.ob[SCOPE_ID]) {
                this.node.attributes["data-scoped-" + this.ob[SCOPE_ID]] = undefined;
            }

            this.ext.render?.appendNode(this.node, index);

            if (index === undefined) {
                this.parent.childrens.push(this.node);
            } else {
                this.parent.childrens.splice(index, 0, this.node);
            }
            this.notifyNodeWatcher("append");
        }
    }

    protected afterParser() {
        this.ext.nodeTransition(this.node, "enter");
    }

    /**
     * 通知节点观察者
     * @param type 通知类型
     */
    protected notifyNodeWatcher(type: NodeChangeType, propertyKey?: string) {
        //除非destroy 否则node 有值
        this.ext.notifyNodeWatcher(this.ref, this.node!, type, propertyKey);
    }

    /**
     * 运行表达式方法，并返回运行后的值（不带观察者）
     * @param express 表达式 string|function
     * @param ob 数据源
     * @returns
     */
    protected runExpress(express: string, ob: any): any {
        try {
            return createExpress(express).call(ob, ob, __GLONAL_FUNTIONS__);
        } catch (e) {
            logger.error(LOGTAG, "运行表达式出现错误:" + express, {
                ob
            });
            console.error(e);
        }
    }

    /**
     * 运行表达式方法，并返回运行后的值（带观察者）
     * @param express 表达式 string|function
     * @param ob 数据源
     * @param updateCallBack 更新回调
     * @param forceCallBack 是否强制回调
     * @returns
     */
    protected runExpressWithWatcher(
        express: string | Function,
        ob: any,
        updateCallBack: (newVal: any, oldVal: any, isEqul: boolean, wathcer: Watcher) => void,
        forceCallBack?: boolean
    ) {
        if (this.isDestroy) return;
        let expressFunction = typeof express === "string" ? createExpress(express) : express;

        let watcher = new Watcher(
            () => {
                if (this.isDestroy || ob[IS_DESTROY]) {
                    return BREAK_WATCH_UPDATE;
                }
                try {
                    return expressFunction.call(ob, ob, __GLONAL_FUNTIONS__);
                } catch (e) {
                    logger.error(LOGTAG, "运行表达式出现错误", {
                        ob,
                        express,
                        node: this.node
                    });
                    console.error(e);

                    return BREAK_WATCH_UPDATE;
                }
            },
            updateCallBack,
            undefined,
            forceCallBack
        );

        //添加 watcher 时会有防重复和空dep判断
        this.addWatch(watcher);

        return watcher.value === BREAK_WATCH_UPDATE ? undefined : watcher.value;
    }

    /**
     * 添加观察者
     * @param watcher
     */
    protected addWatch(watcher: Watcher<any>) {
        if (this.watchers.includes(watcher) === false) {
            this.watchers.push(watcher);
        }
    }

    /**
     * 清空所有观察者
     */
    protected clearWatchers() {
        this.watchers.forEach((w) => {
            w.destroy();
        });

        this.watchers.length = 0;
    }
}
