import { AST, IComponent } from "@joker.front/ast";
import { Component as ComponentClass } from "../component";
import { ObType } from ".";
import { SectionType } from "../component";
import { IParser } from "./parser";

export const JOKER_VNODE_TAG = Symbol.for("JOKER_VNODE_TAG");
/**
 * Virtual DOM (VNode)
 *
 * This control classification differs from AST, as it is divided based on the actual output type.
 */
export namespace VNode {
    export const PARSERKEY = Symbol.for("JOKER_PARSER_KEY");

    /**
     * Base class for VNode
     */
    export class Node {
        [JOKER_VNODE_TAG] = true;
        /**
         * Whether it is a static node (non-dynamic), such as element, text, comment, etc.
         */
        public static?: boolean;

        public output?: any;

        public [PARSERKEY]?: IParser<AST.Node, VNode.Node>;

        public childrens?: Node[];

        public ref?: string;
        /**
         * Whether the current node is in sleep state
         */
        public sleep: boolean = false;

        /** 保存定时器ID，用于节点销毁时清理 */
        public _timerIds?: number[];
        /** 保存事件监听器引用，用于节点销毁时清理 */
        public _eventListeners?: Array<[target: any, event: string, handler: EventListener]>;

        /** 直接缓存前一个节点引用，避免每次indexOf O(n)遍历 */
        public prev?: Node;
        /** 直接缓存后一个节点引用，避免每次indexOf O(n)遍历 */
        public next?: Node;

        constructor(public parent?: Node) {}

        /**
         * 维护子节点的prev/next指针
         */
        public maintainChildrenPointers() {
            const childrens = this.childrens;
            if (!childrens?.length) return;

            for (let i = 0, len = childrens.length; i < len; i++) {
                const child = childrens[i];
                child.prev = i > 0 ? childrens[i - 1] : undefined;
                child.next = i < len - 1 ? childrens[i + 1] : undefined;
                child.parent = this;
            }
        }

        /**
         * Find the first ancestor element that matches the filter
         * @param filter Filter condition: return true to select the current node
         * @param shouldBreak Custom stop condition: return true to stop searching upwards
         * @returns The matched ancestor node or undefined
         */
        public closest<T extends VNode.Node = VNode.Element & VNode.Component>(
            filter: (node: VNode.Node) => true | any,
            shouldBreak?: (node: VNode.Node) => true | any
        ): T | undefined {
            if (filter(this) === true) {
                return this as unknown as T;
            }

            let parent = this.parent;

            while (parent) {
                if (filter(parent) === true) {
                    return parent as T;
                }
                if (shouldBreak?.(parent) === true) break;
                parent = parent.parent;
            }
            return;
        }

        /**
         * Find all child elements that match the filter
         * @param filter Return true to include the node
         * @param shouldBreak Custom stop condition: return true to stop searching downwards
         * @param deepSearch Whether to search deeply (default: false). If true, continue searching after matching.
         * @returns Array of matched nodes
         */
        public find<T extends VNode.Node = VNode.Element & VNode.Component>(
            filter: (node: VNode.Node) => true | any,
            shouldBreak?: (node: VNode.Node) => true | any,
            deepSearch?: boolean
        ): Array<T> {
            const result: Array<VNode.Node> = [];
            if (!this.childrens?.length) return result as T[];

            // 递归实现，V8优化极佳，前端模板深度不会超过20层，无栈溢出风险
            for (let i = 0; i < this.childrens.length; i++) {
                const item = this.childrens[i];
                const findResult = filter(item);
                if (findResult === true) {
                    result.push(item);
                    if (!deepSearch) continue;
                }

                if (shouldBreak?.(item) === true) continue;

                if (item.childrens?.length) {
                    result.push(...item.find(filter, shouldBreak, deepSearch));
                }
            }

            return result as T[];
        }

        /**
         * Check if any child node matches the filter
         * @param filter Return true to include the node, return false to skip its children
         * @returns True if any child matches, false otherwise
         */
        public contains(filter: (node: VNode.Node) => true | any): boolean {
            if (!this.childrens?.length) return false;

            for (let i = 0; i < this.childrens.length; i++) {
                const item = this.childrens[i];
                if (filter(item) === true) {
                    return true;
                }
                if (item.childrens?.length && item.contains(filter)) {
                    return true;
                }
            }

            return false;
        }

        /**
         * Find the first child node that matches the filter
         * @param filter Return true to select the node
         * @returns The first matched child node or undefined
         */
        public first<T extends VNode.Node = VNode.Element & VNode.Component>(
            filter: (node: VNode.Node) => true | any
        ): T | undefined {
            if (!this.childrens?.length) return undefined;

            for (let i = 0; i < this.childrens.length; i++) {
                const item = this.childrens[i];
                if (filter(item) === true) {
                    return item as T;
                }
                if (item.childrens?.length) {
                    const found = item.first(filter);
                    if (found) return found as unknown as T;
                }
            }

            return undefined;
        }

        /**
         * First element VNode of the current node
         */
        public get firstElement(): VNode.Element | undefined {
            if (!this.childrens?.length) return undefined;

            const findElement = (childrens: Array<VNode.Node>): VNode.Element | undefined => {
                for (const item of childrens) {
                    if (item instanceof VNode.Element) {
                        return item;
                    }
                    if (item.childrens?.length) {
                        const result = findElement(item.childrens);
                        if (result) return result;
                    }
                }
                return undefined;
            };

            return findElement(this.childrens);
        }

        /** Get root element nodes (including VNode.Html) */
        public get rootElements(): Array<VNode.Element | VNode.Html> {
            const result: (VNode.Element | VNode.Html)[] = [];
            if (!this.childrens?.length) return result;

            const findRootElements = (childrens: Array<VNode.Node>) => {
                for (const item of childrens) {
                    if (item instanceof VNode.Element) {
                        result.push(item);
                    } else if (item instanceof VNode.Html) {
                        result.push(item);
                    } else if (item.childrens?.length) {
                        findRootElements(item.childrens);
                    }
                }
            };

            findRootElements(this.childrens);
            return result;
        }
    }

    /**
     * Root node
     */
    export class Root<T extends IComponent = IComponent & Record<string, any>> extends Node {
        public childrens: Node[] = [];

        public component!: T;

        constructor() {
            super();
        }
    }

    /**
     * Text node
     */
    export class Text extends Node {
        public static = true;

        constructor(
            public text: string,
            parent: Node
        ) {
            super(parent);
        }
    }

    /**
     * HTML node
     */
    export class Html extends Node {
        public static = true;
        public scopedId?: string;
        constructor(
            public html: string,
            parent: Node,
            public notShadow?: boolean
        ) {
            super(parent);
        }
    }

    /**
     * Comment node
     */
    export class Comment extends Node {
        public static = true;

        constructor(
            public text: string,
            parent: Node
        ) {
            super(parent);
        }
    }

    /**
     * Element node
     */
    export class Element extends Node {
        public static = true;

        public attributes: Record<string, any> = {};

        public childrens: Node[] = [];

        public events: Array<[string, { modifiers?: string[]; callBack: EventCallBack }]> = [];

        /**
         * Auxiliary event storage for storing assist events like 'outside'
         */
        public _assistEventCache?: Array<[string, (e: any) => void]>;

        constructor(
            public tagName: string,
            parent: Node
        ) {
            super(parent);
        }
    }

    export type Event<T = undefined, N extends VNode.Node = VNode.Element & VNode.Component> = {
        /**
         * Event name
         */
        eventName: string;
        /**
         * Native event corresponding to the runtime platform
         */
        event?: any;
        /** Target element that triggered the event */
        target?: N;
        /** Prevent default event behavior */
        preventDefault(): void;
        /** Stop event propagation */
        stopPropagation(): void;
        /** Event parameters */
        data: T;
    };

    export type EventCallBack<T = any> = (e: Event<T>) => void;

    /**
     * Component node
     */
    export class Component<T extends ComponentClass = ComponentClass<any> & Record<string, any>> extends Node {
        /** Component name (template tag name) */
        public name?: string;

        /** Component instance */
        public component!: T;

        /** Events */
        public events: Array<[string, { modifiers?: string[]; callBack: EventCallBack }]> = [];

        /** Properties values */
        public propValues: Record<string, any> = {};

        /** Whether to keep the component alive */
        public keepalive?: boolean;
    }

    /**
     * Condition node
     */
    export class Condition extends Node {
        public result: boolean = false;

        public childrens: Node[] = [];

        public isShow: boolean = false;

        constructor(
            public cmdName: AST.IfCommand["kind"],
            parent: Node
        ) {
            super(parent);
        }
    }

    /**
     * List node, containing multiple list items
     */
    export class List extends Node {
        public childrens: ListItem[] = [];
    }

    /**
     * List item for looping
     */
    export class ListItem extends Node {
        public childrens: Node[] = [];

        constructor(
            public ob: ObType,
            parent: VNode.Node
        ) {
            super(parent);
        }
    }

    /**
     * Render section node (slot)
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
