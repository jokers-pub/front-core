import { escape2Html, isEmptyStr, isObject, logger, remove, removeFilter } from "@joker.front/shared";
import { VNode } from "./vnode";
const LOGTAG = "DOM Rendering";

const TAG_PLAINTEXT_ELEMENT = ["script", "style", "textarea", "pre"];

type TransitionType = "transition" | "animation";

let eventSeed = 0;

const svgElementTags = [
    "svg",
    "defs",
    "use",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "path",
    "text",
    "g"
];

export namespace Render {
    /**
     * Inversion of Control tag ID for rendering
     */
    export const IRENDERIOCTAGID = Symbol.for("JOKER_IRENDERIOC_TAGID");

    export let ROOT_CONTAINER: string = "";
    /**
     * Note: appendNode is executed during rendering, and mount is called once at the end.
     * There will be no scenario where the root is appended because command groups take precedence.
     * append and remove methods do not require a parent parameter because after mounting,
     * the relationship is established, and they are executed directly based on that relationship.
     * Upstream calls do not need to care about the parent, especially during watch cycles.
     */
    export interface IRender {
        /**
         * Mount the rendering to a root container
         * @param root Root container (element or component)
         * Root type is not restricted for multi-platform compatibility
         */
        mount(root: any): void;

        /**
         * Append a node to the rendering
         * @param node VNode to append
         * @param index Optional index for insertion
         */
        appendNode(node: VNode.Node, index?: number): void;

        /**
         * Update a node's properties
         * @param node VNode to update
         * @param propertyKey Property to update (optional)
         */
        updateNode(node: VNode.Node, propertyKey?: string): void;

        /**
         * Remove a node from the rendering
         * @param node VNode to remove
         * @param parent Optional parent node (root if undefined)
         * @param reserveOutPut Whether to retain the output
         */
        removeNode(node: VNode.Node, reserveOutPut?: boolean): void;

        /**
         * Destroy the renderer, unmount DOM and release resources
         */
        destroy(): void;

        /**
         * Handle element transition enter animation
         */
        elementToEnter(node: VNode.Element, name: string, type?: TransitionType, callBack?: Function): void;

        /**
         * Handle element transition leave animation
         */
        elementToLeave(node: VNode.Element, name: string, type?: TransitionType, callBack?: Function): void;

        /**
         * Trigger a component event
         * @param node Component node
         * @param eventName Event name
         * @returns false to stop propagation
         */
        triggerEvent(node: VNode.Component, eventName: string, e: VNode.Event): void | false;
    }

    /**
     * Default renderer using HTML DOM
     */
    export class DomRender implements IRender {
        public elements: DocumentFragment;

        constructor() {
            this.elements = document.createDocumentFragment();
        }

        mount(root: Element | VNode.Component): void {
            if (root instanceof Element) {
                root.appendChild(this.elements);
            } else if (root instanceof VNode.Component) {
                if (root.parent) {
                    if (root.output) {
                        const nodeEl = root.output as Element;
                        const parentEl = getVNodeAppendToContainer(root) || nodeEl.parentNode;

                        // Parent element should always exist
                        if (parentEl) {
                            parentEl.insertBefore(this.elements, nodeEl);
                        }
                    } else {
                        logger.error(LOGTAG, "Component mount found no DOM target node", root);
                    }
                } else {
                    logger.error(LOGTAG, "Mounting child component with no parent", root);
                }
            } else {
                logger.error(LOGTAG, "Mount only supports Element or VNode.Node", root);
            }
        }

        appendNode(node: VNode.Node, index?: number): void {
            this.renderNode(node);

            if (node.output) {
                const nodes =
                    node.output instanceof HTMLCollection ||
                    node.output instanceof NodeList ||
                    Array.isArray(node.output)
                        ? Array.from(node.output)
                        : [node.output];

                for (const item of nodes) {
                    this.appendNodeChildren(node, item, node.parent, index);
                }

                return;
            }

            logger.error(LOGTAG, "No output found for node, cannot mount", node);
        }

        updateNode(node: VNode.Node, propertyKey?: string): void {
            if (node instanceof VNode.Element) {
                for (const attrName in node.attributes) {
                    const attrVal = node.attributes[attrName];
                    this.setAttribute(node.output, attrName, attrVal);
                }
            } else if (node instanceof VNode.Text) {
                if (
                    node.parent &&
                    node.parent instanceof VNode.Element &&
                    TAG_PLAINTEXT_ELEMENT.includes(node.parent.tagName)
                ) {
                    this.removeNode(node);
                    this.appendNode(node);
                } else {
                    (node.output as Text).textContent = escape2Html(node.text || "");
                }
            } else if (node instanceof VNode.Html) {
                if (node.notShadow) {
                    node.output.innerHTML = node.html;
                    if (node.scopedId) {
                        addDataScopedAttribute(node.output, node.scopedId);
                    }
                } else {
                    node.output.root.innerHTML = node.html;
                }
            } else {
                logger.error(LOGTAG, `Node does not support ${propertyKey} update`, node);
            }
        }

        removeNode(node: VNode.Node, reserveOutPut?: boolean): void {
            const domNodes =
                node.output instanceof HTMLCollection || node.output instanceof NodeList || Array.isArray(node.output)
                    ? Array.from(node.output)
                    : [node.output];

            domNodes?.forEach((item) => item?.remove());

            if (!reserveOutPut) {
                node instanceof VNode.Element && removeAssistEvent(node);
                node.output = undefined;
            }
        }

        destroy(): void {
            (<any>this.elements) = undefined;
        }

        elementToEnter(node: VNode.Element, name: string, type?: TransitionType, callBack?: Function): void {
            if (!node.output) return;
            this.transitionFrame(node, name, "enter", type, callBack);
        }

        elementToLeave(node: VNode.Element, name: string, type?: TransitionType, callBack?: Function): void {
            if (!node.output) return;
            this.transitionFrame(node, name, "leave", type, callBack);
        }

        triggerEvent(node: VNode.Component, _eventName: string, _e: VNode.Event): void | false {
            const removeEvent: any[] = [];
            for (const item of node.events) {
                const [eventName, event] = item;

                if (eventName === _eventName) {
                    const isSelf = event.modifiers?.includes("self");
                    const isOutSide = event.modifiers?.includes("outside");

                    if (isSelf || isOutSide) {
                        logger.warn(LOGTAG, "Event modifiers 'self' and 'outside' not supported in components", node);
                        continue;
                    }

                    const e = _e.event;

                    if (
                        (e instanceof KeyboardEvent && ["keydown", "keypress", "keyup"].includes(eventName)) ||
                        (e instanceof MouseEvent && ["click", "dbclick", "mouseup", "mousedown"].includes(eventName))
                    ) {
                        if (checkEventModifier(e, event.modifiers) === false) continue;
                    }

                    event.callBack(_e);

                    if (event.modifiers?.includes("prevent")) {
                        _e.preventDefault();
                    }

                    if (event.modifiers?.includes("once")) {
                        removeEvent.push(item);
                    }

                    if (event.modifiers?.includes("stop")) {
                        _e.stopPropagation();
                        return false;
                    }
                }
            }

            if (removeEvent.length) {
                removeEvent.forEach((e) => remove(node.events, e));
            }
        }

        //#region Private implementations
        private transitionFrame(
            node: VNode.Element,
            transitionName: string,
            model: "leave" | "enter",
            type?: TransitionType,
            callBack?: Function
        ): void {
            addClassName(node, getTransitionClassName(transitionName, model, "from"));
            type ||= "transition";

            const id = (node!.output!.__TRANSITION_EVNETID__ = eventSeed++);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!node.output) return;
                    addClassName(node, getTransitionClassName(transitionName, model, "active"));
                    removeClassName(node, getTransitionClassName(transitionName, model, "from"));
                    addClassName(node, getTransitionClassName(transitionName, model, "to"));

                    const transitionInfo = getTransitionInfo(node.output!, type!);

                    if (!transitionInfo) {
                        callBack?.();
                        return;
                    }

                    let ended = 0;

                    const resolve = () => {
                        removeClassName(node, getTransitionClassName(transitionName, model, "to"));
                        removeClassName(node, getTransitionClassName(transitionName, model, "active"));
                        if (!node.output) return;
                        node.output.removeEventListener(`${type}end`, onEnd);
                        if (id === node!.output!.__TRANSITION_EVNETID__) {
                            callBack?.();
                        }
                    };

                    const onEnd = (e: Event) => {
                        if (e.target === node.output && ++ended >= transitionInfo.count) {
                            resolve();
                        }
                    };

                    setTimeout(() => {
                        if (ended < transitionInfo.count) {
                            resolve();
                        }
                    }, transitionInfo.timeout + 1);

                    node.output?.addEventListener(`${type}end`, onEnd);
                });
            });
        }

        private renderNode(node: VNode.Node): void {
            if (node.output) return;

            if (node instanceof VNode.Text) {
                if (
                    node.parent &&
                    node.parent instanceof VNode.Element &&
                    TAG_PLAINTEXT_ELEMENT.includes(node.parent.tagName)
                ) {
                    node.output = this.parserHtml(node.text);
                } else {
                    node.output = document.createTextNode(escape2Html(node.text || ""));
                }
            } else if (node instanceof VNode.Html) {
                if (node.notShadow) {
                    const container = document.createElement("joker-html-container");
                    //@ts-ignore
                    container.JOKER_NODE = node;
                    container.innerHTML = node.html;
                    if (node.scopedId) {
                        container.setAttribute("data-scoped-" + node.scopedId, "");
                        addDataScopedAttribute(container, node.scopedId);
                    }
                    node.output = container;
                } else {
                    const conatiner = document.createElement("joker-html-shadow") as HtmlContainerWebComponent;
                    //@ts-ignore
                    conatiner.JOKER_NODE = node;
                    conatiner.style.lineHeight = "1";
                    conatiner.root.innerHTML = node.html;
                    node.output = conatiner;
                }
            } else if (node instanceof VNode.Element) {
                let element: any;
                const tagName = node.tagName.toLowerCase();

                //@ts-ignore
                if (tagName === "svg" || svgElementTags.includes(tagName) || node.parent?.inSvg) {
                    //@ts-ignore
                    node.inSvg = true;
                    element = document.createElementNS("http://www.w3.org/2000/svg", node.tagName);
                } else {
                    element = document.createElement(node.tagName);
                }

                for (const attrName in node.attributes) {
                    this.setAttribute(element, attrName, node.attributes[attrName]);
                }
                //@ts-ignore
                element.JOKER_NODE = node;

                node.output = element;

                if (node.events.some((n) => n[0] === "click" && n[1].modifiers?.includes("outside"))) {
                    setTimeout(() => {
                        this.initElementEvents(element, node);
                    });
                } else {
                    this.initElementEvents(element, node);
                }
            } else if (node instanceof VNode.Comment) {
                node.output = document.createComment(node.text);
            } else {
                node.output = document.createTextNode("");
            }
        }

        private initElementEvents(el: HTMLElement, node: VNode.Element) {
            for (const [eventName, event] of node.events) {
                const isSelf = event.modifiers?.includes("self");
                let isOutSide = event.modifiers?.includes("outside");

                if (isSelf && isOutSide) {
                    logger.warn(LOGTAG, "Event modifiers 'self' and 'outside' cannot coexist, using 'self'", node);
                    isOutSide = false;
                }

                const eventCallBack = (e: Event) => {
                    if (node.sleep) return;

                    if (isSelf) {
                        if (e.target !== el) return;
                    }

                    if (isOutSide) {
                        if (e.target === el || el.contains(<any>e.target)) return;
                        if (document.contains(<any>e.target) === false) return;
                        if (
                            node.contains((n) => {
                                const nodes =
                                    n.output instanceof HTMLCollection ||
                                    n.output instanceof NodeList ||
                                    Array.isArray(n.output)
                                        ? Array.from(n.output)
                                        : [n.output];
                                return nodes.includes(e.target);
                            })
                        ) {
                            return true;
                        }
                    }

                    if (
                        (e instanceof KeyboardEvent && ["keydown", "keypress", "keyup"].includes(eventName)) ||
                        (e instanceof MouseEvent && ["click", "dbclick", "mouseup", "mousedown"].includes(eventName))
                    ) {
                        if (checkEventModifier(e, event.modifiers) === false) return;
                    }

                    event.callBack({
                        eventName,
                        event: e,
                        target: node,
                        preventDefault: () => e.preventDefault(),
                        stopPropagation: () => e.stopPropagation(),
                        data: undefined
                    });

                    if (event.modifiers?.includes("prevent")) {
                        e.preventDefault();
                    }

                    if (event.modifiers?.includes("stop")) {
                        e.stopPropagation();
                    }

                    if (event.modifiers?.includes("once")) {
                        if (isOutSide) {
                            removeAssistEvent(node, eventName, eventCallBack);
                        } else {
                            el.removeEventListener(eventName, eventCallBack);
                        }
                    }
                };

                let eventOpt = undefined;
                if (event.modifiers?.includes("passive")) {
                    eventOpt = {
                        passive: true
                    };
                }

                if (isOutSide) {
                    registoryAssistEvent(node, eventName, eventCallBack, eventOpt);
                } else {
                    el.addEventListener(eventName, eventCallBack, eventOpt);
                }
            }
        }

        private parserHtml(str: string): NodeList {
            const tempContainer = document.createElement("div");
            tempContainer.innerHTML = str;
            return tempContainer.childNodes;
        }

        private isCommandGroup(node: VNode.Node) {
            return (
                node instanceof VNode.Component ||
                node instanceof VNode.Condition ||
                node instanceof VNode.List ||
                node instanceof VNode.ListItem ||
                node instanceof VNode.RenderSection
            );
        }

        private appendNodeChildren(node: VNode.Node, element: Element, parent?: VNode.Node, index?: number) {
            let parentEl = getVNodeAppendToContainer(node);

            if (parentEl) {
                parentEl.appendChild(element);
                return;
            }

            if (parent === undefined) {
                this.elements?.appendChild(element);
            } else if (parent) {
                if (parent instanceof VNode.Root) {
                    const containerParent = parent.parent;
                    if (containerParent && containerParent instanceof VNode.Component) {
                        if (containerParent.output) {
                            const nodeEl = containerParent.output as Element;
                            const parentEl = nodeEl?.parentNode;
                            if (parentEl) {
                                parentEl.insertBefore(element, nodeEl);
                                return;
                            }
                        }
                    }
                    this.elements?.appendChild(element);
                } else if (parent instanceof VNode.Element) {
                    const parentEl = parent.output;
                    if (parentEl === undefined) return;
                    parentEl.appendChild(element);
                } else if (this.isCommandGroup(parent)) {
                    const parentEl = parent.output?.parentNode as HTMLElement;

                    if (index !== undefined && parent.childrens?.length && parentEl) {
                        const prevNodeIndex = index - 1;
                        if (prevNodeIndex < 0) {
                            const firstNode = getNodePrevInstallPosition(node);
                            if (firstNode && parentEl.contains(firstNode.output)) {
                                firstNode.output.after(element);
                            } else {
                                parentEl.insertBefore(element, parentEl.firstChild);
                            }
                            return;
                        } else {
                            const prevNode = parent.childrens[prevNodeIndex];
                            if (prevNode) {
                                const appendNodeTag = <HTMLElement>prevNode.output;
                                if (appendNodeTag) {
                                    appendNodeTag.after(element);
                                    return;
                                }
                            }
                        }
                    }

                    if (parentEl) {
                        parentEl.insertBefore(element, parent.output);
                    }
                } else {
                    logger.error(LOGTAG, "Node does not support nested children", { node, parent });
                }
            }
        }

        private setAttribute(el: HTMLElement, attrName: string, attrVal: any) {
            if (!el) return;
            if (typeof attrVal === "boolean") {
                if (attrVal) {
                    el.setAttribute(attrName, "");
                } else {
                    el.removeAttribute(attrName);
                }
                return;
            }

            if (attrName === "class") {
                if (attrVal) {
                    let newClass = flatClassValues(attrVal);
                    attrVal = newClass.join(" ");
                }
            } else if (attrName === "style" && isObject(attrVal)) {
                el.removeAttribute("style");
                for (const name in attrVal) {
                    let isEmptyValue = false;
                    if (attrVal[name] === undefined || attrVal[name] === false) {
                        isEmptyValue = true;
                    }
                    const val = String(attrVal[name]);
                    if (isEmptyStr(val)) {
                        isEmptyValue = true;
                    }
                    if (!isEmptyValue) {
                        //@ts-ignore
                        el.style[name] = val;
                    }
                }
                return;
            }

            attrVal = (attrVal ?? "").toString().trim();
            if (attrName === "class") {
                attrVal = (<string>attrVal)
                    .split(/\s/)
                    .filter((m) => m.trim())
                    .join(" ");
            }
            if (attrName === "value" && "value" in el) {
                el.value = attrVal;
            } else {
                if (attrName === "xlink:href") {
                    el.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", attrVal);
                } else {
                    el.setAttribute(attrName, attrVal);
                }
            }
        }
        //#endregion
    }
}

export function getTransitionClassName(
    transition: string,
    mode: "enter" | "leave",
    type: "from" | "active" | "to"
): string {
    return `${transition}-${mode}-${type}`;
}

/**
 * Register assist event for outside event handling
 */
function registoryAssistEvent(
    node: VNode.Element,
    eventName: string,
    eventCallBack: (e: Event) => void,
    eventOpt: any
) {
    node._assistEventCache ??= [];
    node._assistEventCache.push([eventName, eventCallBack]);
    document.body.addEventListener(eventName, eventCallBack, eventOpt);
}

function removeAssistEvent(node: VNode.Element, eventName?: string, eventCallBack?: (e: Event) => void) {
    if (node._assistEventCache && eventName && eventCallBack) {
        removeFilter(node._assistEventCache, (m) => m[0] === eventName && m[1] === eventCallBack);
        document.body.removeEventListener(eventName, eventCallBack);
    } else {
        node._assistEventCache?.forEach((m) => {
            document.body.removeEventListener(m[0], m[1]);
        });
        node._assistEventCache && (node._assistEventCache.length = 0);
        node._assistEventCache = undefined;
    }
}

const keyEventModifierNative = {
    enter: "enter",
    backspace: "delete",
    tab: "tab",
    arrowup: "up",
    arrowdown: "down",
    arrowleft: "left",
    arrowright: "right",
    escape: "esc",
    " ": "space"
};

function checkEventModifier(e: KeyboardEvent | MouseEvent, modifiers?: string[]): boolean {
    if (e instanceof KeyboardEvent) {
        if (e.key === undefined) return false;
        for (const name in keyEventModifierNative) {
            if (
                //@ts-ignore
                modifiers?.includes(keyEventModifierNative[name]) &&
                e.key.toLowerCase() !== name
            )
                return false;
        }
    } else {
        if (modifiers?.includes("left") && e.button !== 0) return false;
        if (modifiers?.includes("right") && e.button !== 2) return false;
        if (modifiers?.includes("middle") && e.button !== 1) return false;
    }

    if (modifiers?.includes("ctrl") && e.ctrlKey === false) return false;
    if (modifiers?.includes("alt") && e.altKey === false) return false;
    if (modifiers?.includes("shift") && e.shiftKey === false) return false;

    return true;
}

function addClassName(node: VNode.Element, className: string) {
    if (!node.output) return;
    (<HTMLElement>node.output).classList.add(className);
}

function removeClassName(node: VNode.Element, className: string) {
    if (!node.output) return;
    (<HTMLElement>node.output).classList.remove(className);
}

function getVNodeAppendToContainer(node: VNode.Node) {
    if (node instanceof VNode.Element || node instanceof VNode.Component) {
        let appendTo = node instanceof VNode.Component ? node.propValues["append-to"] : node.attributes["append-to"];

        if (appendTo) {
            if (appendTo instanceof VNode.Element) {
                return appendTo.output;
            } else if (typeof appendTo === "string") {
                if (Render.ROOT_CONTAINER) {
                    if (appendTo === "body") {
                        appendTo = Render.ROOT_CONTAINER;
                    } else {
                        appendTo = `${Render.ROOT_CONTAINER} ${appendTo}`;
                    }
                }
                const dom = document.querySelector(appendTo);
                if (dom) return dom;
            }
            logger.warn(LOGTAG, "Unsupported appendTo type", { appendTo, node });
        }
    }
}

function getTransitionInfo(el: Element, type: TransitionType) {
    const styles = window.getComputedStyle(el);
    const getStyleProperties = (key: any) => (styles[key] || "").split(", ");

    if (type === "transition") {
        const delays = getStyleProperties("transitionDelay");
        const durations = getStyleProperties("transitionDuration");
        const timeout = getTimeout(delays, durations);
        if (timeout > 0) {
            return {
                timeout,
                count: durations.length
            };
        }
    } else if (type === "animation") {
        const delays = getStyleProperties("animationDelay");
        const durations = getStyleProperties("animationDuration");
        const timeout = getTimeout(delays, durations);
        if (timeout > 0) {
            return {
                timeout,
                count: durations.length
            };
        }
    }
}

function getTimeout(delays: string[], durations: string[]): number {
    while (delays.length < durations.length) {
        delays.concat(delays);
    }
    return Math.max(...durations.map((d, i) => toMs(d) + toMs(delays[i])));
}

function toMs(s: string): number {
    if (s === "auto") return 0;
    return Number(s.slice(0, -1).replace(",", ".")) * 1000;
}

function getNodePrevInstallPosition(node: VNode.Node, notSearchParent?: boolean): VNode.Node | undefined {
    let prev = node.prev;
    while (prev) {
        if (prev instanceof VNode.ListItem === false) {
            return prev;
        }
        prev = prev.prev;
    }

    if (!notSearchParent) {
        let parent = node.parent;
        while (parent) {
            if (parent instanceof VNode.Element) return;
            const result = getNodePrevInstallPosition(parent, true);
            if (result) return result;
            parent = parent.parent;
        }
    }
    return;
}

class HtmlContainerWebComponent extends HTMLElement {
    root: ShadowRoot;

    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
    }
}

!customElements.get("joker-html-shadow") && customElements.define("joker-html-shadow", HtmlContainerWebComponent);

/**
 * Recursively add data-scoped attributes to all elements
 */
function addDataScopedAttribute(element: HTMLElement, scoped: string) {
    const childNodes = element.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        if (node.nodeType === 1) {
            const childElement = node as HTMLElement;
            childElement.setAttribute("data-scoped-" + scoped, "");
            addDataScopedAttribute(childElement, scoped);
        }
    }
}

function flatClassValues(value: any, _result?: string[]): string[] {
    const result: string[] = _result || [];

    if (typeof value === "string") {
        const trimmedClass = value.trim();

        if (trimmedClass && !result.includes(trimmedClass)) {
            result.push(trimmedClass);
        }
    } else if (Array.isArray(value)) {
        value.forEach((item) => flatClassValues(item, result));
    } else if (value !== null && typeof value === "object") {
        Object.entries(value).forEach(([key, val]) => {
            if (val === true) {
                const trimmedKey = key.trim();
                if (trimmedKey && !result.includes(trimmedKey)) {
                    result.push(trimmedKey);
                }
            }
        });
    }
    return result;
}
