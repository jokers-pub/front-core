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

        constructor(public parent?: Node) {}

        /**
         * Previous node
         */
        public get prev(): Node | undefined {
            if (this.parent) {
                return this.parent.childrens?.[this.parent.childrens?.indexOf(this) - 1];
            }

            return;
        }

        /**
         * Next node
         */
        public get next(): Node | undefined {
            if (this.parent) {
                return this.parent.childrens?.[this.parent.childrens?.indexOf(this) + 1];
            }
            return;
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
            deepSearch?: boolean,
            _childrens?: Array<VNode.Node>,
            _out?: Array<VNode.Node>
        ): Array<T> {
            let result: Array<VNode.Node> = _out ?? [];

            _childrens ??= this.childrens;

            if (_childrens) {
                for (let item of _childrens) {
                    let findResult = filter(item);
                    if (findResult === true) {
                        result.push(item);

                        if (!deepSearch) continue;
                    }

                    if (shouldBreak?.(item) === true) continue;

                    if (item.childrens) {
                        this.find(filter, shouldBreak, deepSearch, item.childrens, result);
                    }
                }
            }

            return result as T[];
        }

        /**
         * Check if any child node matches the filter
         * @param filter Return true to include the node, return false to skip its children
         * @returns True if any child matches, false otherwise
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

        /**
         * Find the first child node that matches the filter
         * @param filter Return true to select the node
         * @returns The first matched child node or undefined
         */
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

        constructor(public text: string, parent: Node) {
            super(parent);
        }
    }

    /**
     * HTML node
     */
    export class Html extends Node {
        public static = true;
        public scopedId?: string;
        constructor(public html: string, parent: Node, public notShadow?: boolean) {
            super(parent);
        }
    }

    /**
     * Comment node
     */
    export class Comment extends Node {
        public static = true;

        constructor(public text: string, parent: Node) {
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

        constructor(public tagName: string, parent: Node) {
            super(parent);
        }
    }

    export type Event<T = undefined, N extends VNode.Node = VNode.Element | VNode.Component | VNode.Root> = {
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

        /**
         * First element VNode of the current component
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

        /** Get root element nodes (including VNode.Html) */
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
     * Condition node
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

        constructor(public ob: ObType, parent: VNode.Node) {
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
