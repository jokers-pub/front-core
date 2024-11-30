import { AST, IComponent } from "@joker.front/ast";
import { Component as ComponentClass } from "../component";
import { ObType } from ".";
import { SectionType } from "../component";
import { IParser } from "./parser";

export const JOKER_VNODE_TAG = Symbol.for("JOKER_VNODE_TAG");
/**
 * 虚拟DOM
 *
 * 该控件分类区别于AST，分类是按照实际输出类型作为划分
 */
export namespace VNode {
    export const PARSERKEY = Symbol.for("JOKER_PARSER_KEY");

    /**
     * VNode 基类
     */
    export class Node {
        [JOKER_VNODE_TAG] = true;
        /**
         * 是否是静态节点，非动态节点。例如：element、text、comment等
         */
        public static?: boolean;

        public output?: any;

        public [PARSERKEY]?: IParser<AST.Node, VNode.Node>;

        public childrens?: Node[];

        /**
         * 当前节点是否睡眠
         */
        public sleep: boolean = false;

        constructor(public parent?: Node) {}

        /**
         * 上一个节点
         */
        public get prev(): Node | undefined {
            if (this.parent) {
                return this.parent.childrens?.[this.parent.childrens?.indexOf(this) - 1];
            }

            return;
        }

        /**
         * 下一个节点
         */
        public get next(): Node | undefined {
            if (this.parent) {
                return this.parent.childrens?.[this.parent.childrens?.indexOf(this) + 1];
            }
            return;
        }

        /**
         * 匹配第一个符合要求的祖先元素
         * @param match
         * @param breakWhenVRoot 是否过滤到当前视图根时中断
         * @returns
         */
        public closest<T extends VNode.Node = VNode.Element & VNode.Component>(
            filter: (node: VNode.Node) => any | any,
            breakWhenVRoot?: boolean
        ): T | undefined {
            if (filter(this) === true) {
                return this as unknown as T;
            }

            let parent = this.parent;

            while (parent) {
                if (breakWhenVRoot && parent instanceof VNode.Root) return;

                if (filter(parent) === true) {
                    return parent as T;
                }

                parent = parent.parent;
            }
            return;
        }

        /**
         * 返回所有匹配的子元素
         * @param filter 返回true则记录，返回false则跳过该元素的子集
         * @returns
         */
        public find<T extends VNode.Node = VNode.Element & VNode.Component>(
            filter: (node: VNode.Node) => true | any,
            childrens?: Array<VNode.Node>,
            _out?: Array<VNode.Node>
        ): Array<T> {
            let result: Array<VNode.Node> = _out ?? [];

            childrens ??= this.childrens;

            if (childrens) {
                for (let item of childrens) {
                    let findResult = filter(item);
                    if (findResult === true) {
                        result.push(item);
                    }

                    if (item.childrens) {
                        this.find(filter, item.childrens, result);
                    }
                }
            }

            return result as T[];
        }

        /**
         * 是否包含
         * @param filter 返回true则记录，返回false则跳过该元素的子集
         * @returns
         */
        public contains(filter: (node: VNode.Node) => true | any, childrens?: Array<VNode.Node>): boolean {
            childrens ??= this.childrens;

            if (childrens) {
                for (let item of childrens) {
                    let findResult = filter(item);
                    if (findResult === true) {
                        return true;
                    }

                    if (item.childrens && item.childrens.length) {
                        if (this.contains(filter, item.childrens)) {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        public first<T extends VNode.Node = VNode.Element & VNode.Component>(
            filter: (node: VNode.Node) => true | any,
            childrens?: Array<VNode.Node>
        ): T | undefined {
            childrens ??= this.childrens;

            if (childrens) {
                for (let item of childrens) {
                    let findResult = filter(item);
                    if (findResult === true) {
                        return item as T;
                    }

                    if (item.childrens && item.childrens.length) {
                        let result = this.first<T>(filter, item.childrens);
                        if (result) {
                            return result;
                        }
                    }
                }
            }

            return;
        }
    }

    /**
     * 根节点
     */
    export class Root<T extends IComponent = IComponent & Record<string, any>> extends Node {
        public childrens: Node[] = [];

        public component!: T;

        constructor() {
            super();
        }
    }

    /**
     * 文本类型节点
     */
    export class Text extends Node {
        public static = true;

        constructor(public text: string, parent: Node) {
            super(parent);
        }
    }

    /**
     * Html节点
     */
    export class Html extends Node {
        public static = true;

        constructor(public html: string, parent: Node, public notShadow?: boolean) {
            super(parent);
        }
    }

    /**
     * 注释节点
     */
    export class Comment extends Node {
        public static = true;

        constructor(public text: string, parent: Node) {
            super(parent);
        }
    }

    /**
     * Element节点
     */
    export class Element extends Node {
        public static = true;

        public attributes: Record<string, any> = {};

        public childrens: Node[] = [];

        public events: Array<[string, { modifiers?: string[]; callBack: EventCallBack }]> = [];

        /**
         * 协助事件存储，用于存储辅助事件，例如outside等事件
         */
        public _assistEventCache?: Array<[string, (e: any) => void]>;

        constructor(public tagName: string, parent: Node) {
            super(parent);
        }
    }

    export type Event<T = undefined, N extends VNode.Node = VNode.Element | VNode.Component | VNode.Root> = {
        /**
         * 事件名称
         */
        eventName: string;
        /**
         * 原生event，对应运行平台
         */
        event?: any;
        /** 触发事件目标元素 */
        target?: N;
        /** 阻止默认事件 */
        preventDefault(): void;
        /** 阻止事件传播 */
        stopPropagation(): void;
        /** 参数 */
        data: T;
    };

    export type EventCallBack<T = any> = (e: Event<T>) => void;

    /**
     * 组件节点
     */
    export class Component<T extends ComponentClass = ComponentClass<any> & Record<string, any>> extends Node {
        /** 组件名（template标签名） */
        public name?: string;

        /** 组件实例 */
        public component!: T;

        /** 事件 */
        public events: Array<[string, { modifiers?: string[]; callBack: EventCallBack }]> = [];

        /** 参数 */
        public propValues: Record<string, any> = {};

        /** 是否保持存活 */
        public keepalive?: boolean;

        /**
         * 当前组件第一个element vnode
         */
        public get firstElement() {
            if (this.childrens) {
                let findElement = (childrens: Array<VNode.Node>) => {
                    for (let item of childrens) {
                        if (item instanceof VNode.Element) {
                            return item;
                        }

                        if (item.childrens) {
                            let result = findElement(item.childrens) as VNode.Element;

                            if (result) return result;
                        }
                    }
                };
                return findElement(this.childrens);
            }
        }

        /** 获取根element 节点 包含VNode.Html */
        public get rootElements() {
            if (this.childrens) {
                let result: (VNode.Element | VNode.Html)[] = [];
                let findElements = (childrens: Array<VNode.Node>) => {
                    for (let item of childrens) {
                        if (item instanceof VNode.Element) {
                            result.push(item);
                        } else if (item instanceof VNode.Html) {
                            result.push(item);
                        } else if (item.childrens) {
                            findElements(item.childrens);
                        }
                    }
                };
                findElements(this.childrens);
                return result;
            }
            return [];
        }
    }

    /**
     * 条件节点
     */
    export class Condition extends Node {
        public result: boolean = false;

        public childrens: Node[] = [];

        public isShow: boolean = false;

        constructor(public cmdName: AST.IfCommand["kind"], parent: Node) {
            super(parent);
        }
    }

    /**
     * 列表节点,内部包含多组列表项
     */
    export class List extends Node {
        public childrens: ListItem[] = [];
    }

    /**
     * 循环列表项
     */
    export class ListItem extends Node {
        public childrens: Node[] = [];

        constructor(public ob: ObType, parent: VNode.Node) {
            super(parent);
        }
    }

    /**
     * 插槽节点
     */
    export class RenderSection extends Node {
        public id: string = "unknown";

        public params: any[] = [];

        public section?: SectionType;

        public childrens: Node[] = [];

        public ob?: ComponentClass & Record<string, any>;

        constructor(idOrSection: string | SectionType, parent: Node) {
            super(parent);
            if (typeof idOrSection === "string") {
                this.id = idOrSection;
            } else {
                this.section = idOrSection;
            }
        }
    }
}
