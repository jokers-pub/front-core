import { escape2Html, isEmptyStr, isObject, logger, remove, removeFilter } from "@joker.front/shared";
import { VNode } from "./vnode";
const LOGTAG = "DOM渲染";

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
     * 注入TagId
     */
    export const IRENDERIOCTAGID = Symbol.for("JOKER_IRENDERIOC_TAGID");

    export let ROOT_CONTAINER: string = "";
    /**
     * 备注：在渲染时执行appendNode，最终执行一次mount挂载
     * 不会出现根目录append的场景，因为指令group会优先占位
     *
     * append 和 remove方法不会存在 parent的参数，因为一次挂载后
     * 会存在关系，根据关系直接执行
     * 上游调用也无需关心parent，特别是在watch周期内
     */
    export interface IRender {
        /**
         * 挂载
         * @param root 挂载根
         * 不限制root类型，为后面做多端兼容
         */
        mount(root: any): void;

        /**
         * 添加节点
         * @param node NodeInfo
         */
        appendNode(node: VNode.Node, index?: number): void;
        /**
         * 更新节点
         * @param node NodeInfo
         * @param propertyKey 更新属性名称
         */
        updateNode(node: VNode.Node, propertyKey?: string): void;
        /**
         * 删除节点
         * @param {VNode.Node} node
         * @param {VNode.Node} parent 如果为空则带表root跟节点下集
         * @param {boolean} reserveOutPut 是否需要保留out产物
         */
        removeNode(node: VNode.Node, reserveOutPut?: boolean): void;
        /**
         * 销毁，卸载DOM并释放变量
         */
        destroy(): void;

        /**
         * element节点transition enter
         */
        elementToEnter(node: VNode.Element, name: string, type?: TransitionType, callBack?: Function): void;

        /**
         * element节点transition leave
         */
        elementToLeave(node: VNode.Element, name: string, type?: TransitionType, callBack?: Function): void;

        /**
         * 触发组件事件
         * @param node
         * @param eventName
         * @returns false 则代表停止广播
         */
        triggerEvent(node: VNode.Component, eventName: string, e: VNode.Event): void | false;
    }

    /**
     * 默认Render，采用H5-DOM模式进行输出
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
                        let nodeEl = root.output as Element;
                        let parentEl = getVNodeAppendToContainer(root) || nodeEl.parentNode;

                        //不会出现没有parentEl的场景
                        if (parentEl) {
                            parentEl.insertBefore(this.elements, nodeEl);
                        }
                    } else {
                        logger.error(LOGTAG, "组件挂载渲染时发现该节点未定义DOM定位节点", root);
                    }
                } else {
                    logger.error(LOGTAG, "mount子组件时，发现该组件无父级", root);
                }
            } else {
                logger.error(LOGTAG, "mount只支持挂载到Element或VNode.Node类型数据中", root);
            }
        }

        appendNode(node: VNode.Node, index?: number): void {
            this.renderNode(node);

            if (node.output) {
                let nodes =
                    node.output instanceof HTMLCollection ||
                    node.output instanceof NodeList ||
                    Array.isArray(node.output)
                        ? Array.from(node.output)
                        : [node.output];

                for (let item of nodes) {
                    this.appendNodeChildren(node, item, node.parent, index);
                }

                return;
            }

            logger.error(LOGTAG, "未找自身节点的el属性，无法进行dom挂载", node);
        }

        updateNode(node: VNode.Node, propertyKey?: string | undefined): void {
            if (node instanceof VNode.Element) {
                for (let attrName in node.attributes) {
                    let attrVal = node.attributes[attrName];

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
                } else {
                    node.output.root.innerHTML = node.html;
                }
            } else {
                logger.error(LOGTAG, `该节点不支持${propertyKey}的更新`, node);
            }
        }

        removeNode(node: VNode.Node, reserveOutPut?: boolean): void {
            let domNodes =
                node.output instanceof HTMLCollection || node.output instanceof NodeList || Array.isArray(node.output)
                    ? Array.from(node.output)
                    : [node.output];

            //可能是root等无根的节点
            domNodes?.forEach((item) => {
                item?.remove();
            });

            if (!reserveOutPut) {
                //element 元素 需要清除辅助事件
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
            let removeEvent: any[] = [];
            for (let item of node.events) {
                let [eventName, event] = item;

                if (eventName === _eventName) {
                    let isSelf = event.modifiers?.includes("self");
                    let isOutSide = event.modifiers?.includes("outside");

                    if (isSelf || isOutSide) {
                        logger.warn(LOGTAG, "事件修饰符：self、outside在组件事件中无法使用，组件无法确认元素", node);
                        continue;
                    }

                    let e = _e.event;

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

            //剔除需要移除的事件
            if (removeEvent.length) {
                removeEvent.forEach((e) => {
                    remove(node.events, e);
                });
            }
        }

        //#region 私有实现
        private transitionFrame(
            node: VNode.Element,
            transitionName: string,
            model: "leave" | "enter",
            type?: TransitionType,
            callBack?: Function
        ): void {
            addClassName(node, getTransitionClassName(transitionName, model, "from"));
            type ||= "transition";

            let id = (node!.output!.__TRANSITION_EVNETID__ = eventSeed++);

            // 在下一帧执行的时候移除class
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!node.output) return;
                    addClassName(node, getTransitionClassName(transitionName, model, "active"));

                    removeClassName(node, getTransitionClassName(transitionName, model, "from"));
                    addClassName(node, getTransitionClassName(transitionName, model, "to"));

                    let transitionInfo = getTransitionInfo(node.output!, type!);

                    if (!transitionInfo) {
                        callBack?.();
                        return;
                    }

                    let ended = 0;

                    // 定义一个供addEventListener执行的回调函数
                    let resolve = () => {
                        removeClassName(node, getTransitionClassName(transitionName, model, "to"));
                        removeClassName(node, getTransitionClassName(transitionName, model, "active"));

                        //可能存在越级删除，造成动画元素过早移除，
                        if (!node.output) return;

                        node.output.removeEventListener(`${type}end`, onEnd);

                        if (id === node!.output!.__TRANSITION_EVNETID__) {
                            callBack?.();
                        }
                    };

                    let onEnd = (e: Event) => {
                        if (e.target === node.output && ++ended >= transitionInfo!.count) {
                            resolve();
                        }
                    };

                    setTimeout(() => {
                        if (ended < transitionInfo!.count) {
                            resolve();
                        }
                    }, transitionInfo.timeout + 1);

                    // 监听动效结束事件，type由props传入
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
                    let conatiner = document.createElement("joker-html-container");
                    //@ts-ignore
                    conatiner.JOKER_NODE = node;
                    conatiner.innerHTML = node.html;

                    node.output = conatiner;
                } else {
                    let conatiner = document.createElement("joker-html-shadow") as HtmlContainerWebComponent;
                    //@ts-ignore
                    conatiner.JOKER_NODE = node;
                    conatiner.style.lineHeight = "1";
                    conatiner.root.innerHTML = node.html;
                    node.output = conatiner;
                }
            } else if (node instanceof VNode.Element) {
                let element: any;
                let tagName = node.tagName.toLowerCase();

                //@ts-ignore
                if (tagName === "svg" || svgElementTags.includes(tagName) || node.parent?.inSvg) {
                    //@ts-ignore
                    node.inSvg = true;
                    element = document.createElementNS("http://www.w3.org/2000/svg", node.tagName);
                } else {
                    element = document.createElement(node.tagName);
                }

                for (let attrName in node.attributes) {
                    this.setAttribute(element, attrName, node.attributes[attrName]);
                }
                //@ts-ignore
                element.JOKER_NODE = node;

                node.output = element;

                //做穿透延迟仅对outside.click
                if (node.events.some((n) => n[0] === "click" && n[1].modifiers?.includes("outside"))) {
                    //宏任务
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
            for (let [eventName, event] of node.events) {
                let isSelf = event.modifiers?.includes("self");
                let isOutSide = event.modifiers?.includes("outside");

                if (isSelf && isOutSide) {
                    logger.warn(LOGTAG, "事件修饰符：self、outside不可以同时存在，将按照self处理", node);
                    isOutSide = false;
                }

                let eventCallBack = function (e: Event) {
                    //节点睡眠时，不做事件传递和广播
                    if (node.sleep) return;

                    /**
                     * self : 必须是本身
                     * prevent : 阻止系统
                     * stop : 阻止冒泡
                     * once : 只触发一次
                     * outside : 外围时触发
                     */

                    if (isSelf) {
                        //不是自身时不执行
                        if (e.target !== el) {
                            return;
                        }
                    }

                    if (isOutSide) {
                        //是自身时不执行
                        if (e.target === el || el.contains(<any>e.target)) {
                            return;
                        }

                        //空冒泡事件
                        if (document.contains(<any>e.target) === false) return;

                        //append-to时，dom层级无法确认
                        if (
                            node.contains((n) => {
                                let nodes =
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
                        /**目标元素 */
                        target: node,
                        /** 阻止默认事件 */
                        preventDefault: () => e.preventDefault(),
                        /** 阻止事件传播 */
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
            var tempContainer = document.createElement("div");

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
                //根节点+appendTo
                this.elements?.appendChild(element);
            } else if (parent) {
                if (parent instanceof VNode.Root) {
                    //root上是VNode.Componet容器
                    let containerParent = parent.parent;
                    if (containerParent && containerParent instanceof VNode.Component) {
                        //这种场景一般只使用与weakup时再挂载
                        if (containerParent.output) {
                            let nodeEl = containerParent.output as Element;
                            let parentEl = nodeEl?.parentNode;

                            //不会出现没有parentEl的场景

                            if (parentEl) {
                                parentEl.insertBefore(element, nodeEl);
                                return;
                            }
                        }
                    }
                    //全部兜底，是存在组件内直接是命令的场景，会出现parent.parent还未挂载
                    //该场景应算顺序执行的产物
                    this.elements?.appendChild(element);
                } else if (parent instanceof VNode.Element) {
                    let parentEl = parent.output;
                    //可能被销毁
                    if (parentEl === undefined) {
                        return;
                    }
                    parentEl.appendChild(element);
                } else if (this.isCommandGroup(parent)) {
                    //如果if 或者 for循环中存在 append-to 则直接向body输出，不考虑body输出顺序
                    let parentEl = parent.output?.parentNode as HTMLElement;

                    if (index !== undefined && parent.childrens?.length && parentEl) {
                        let prevNodeIndex = index - 1;
                        if (prevNodeIndex < 0) {
                            let firstNode = getNodePrevInstallPosition(node);

                            if (firstNode && parentEl.contains(firstNode.output)) {
                                // 可能下节点 是append-to,脱离文档流
                                firstNode.output.after(element);
                            } else {
                                parentEl.insertBefore(element, parentEl.firstChild);
                            }

                            return;
                        } else {
                            let prevNode = parent.childrens[prevNodeIndex];
                            if (prevNode) {
                                let appendNodeTag = <HTMLElement>prevNode.output;
                                if (appendNodeTag) {
                                    appendNodeTag.after(element);
                                    return;
                                }
                            }
                        }
                    }

                    //不会出现没有parentEl的场景
                    if (parentEl) {
                        parentEl.insertBefore(element, parent.output);
                    }
                } else {
                    logger.error(LOGTAG, `该节点不支持嵌套子集，请检查。`, { node, parent });
                }
            }
        }

        private setAttribute(el: HTMLElement, attrName: string, attrVal: any) {
            if (!el) return;
            if (typeof attrVal === "boolean") {
                //如果是boolean，则做新增和删除特性处理
                if (attrVal) {
                    el.setAttribute(attrName, "");
                } else {
                    el.removeAttribute(attrName);
                }
                return;
            }

            if (attrName === "class") {
                if (Array.isArray(attrVal)) {
                    let newClass: string[] = [];
                    for (let val of attrVal) {
                        if (isObject(val)) {
                            for (let name in val) {
                                if (val[name]) {
                                    newClass.push(name);
                                }
                            }
                        } else {
                            val && newClass.push(val);
                        }
                    }

                    attrVal = newClass.join(" ");
                } else if (isObject(attrVal)) {
                    for (let name in attrVal) {
                        name = name.trim();
                        if (!name) continue;
                        if (attrVal[name]) {
                            el.classList.add(name);
                        } else {
                            el.classList.remove(name);
                        }
                    }
                    return;
                }
            } else if (attrName === "style" && isObject(attrVal)) {
                el.removeAttribute("style");

                for (let name in attrVal) {
                    let isEmptyValue = false;
                    if (attrVal[name] === undefined || attrVal[name] === false) {
                        isEmptyValue = true;
                    }

                    let val = String(attrVal[name]);
                    if (isEmptyStr(val)) {
                        isEmptyValue = true;
                    }

                    //非空
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
 * 注册协助事件，用于做outside等全局事件记录
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
        removeFilter(node._assistEventCache, (m) => {
            return m[0] === eventName && m[1] === eventCallBack;
        });

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

        for (let name in keyEventModifierNative) {
            //当有修饰约束 && 约束不成立 则return false 终止

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
                let dom = document.querySelector(appendTo);

                if (dom) return dom;
            }
            logger.warn(LOGTAG, "appendTo类型不支持", { appendTo, node });
        }
    }
}

function getTransitionInfo(el: Element, type: TransitionType) {
    let styles = window.getComputedStyle(el);

    let getStyleProperties = (key: any) => (styles[key] || "").split(", ");

    if (type === "transition") {
        let delays = getStyleProperties("transitionDelay");
        let durations = getStyleProperties("transitionDuration");
        let timeout = getTimeout(delays, durations);

        if (timeout > 0) {
            return {
                timeout,
                count: durations.length
            };
        }
    } else if (type === "animation") {
        let delays = getStyleProperties("animationDelay");
        let durations = getStyleProperties("animationDuration");
        let timeout = getTimeout(delays, durations);

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
    //平级找
    while (prev) {
        //只要不是 内嵌子集的就向后输出
        if (prev instanceof VNode.ListItem === false) {
            return prev;
        }
        prev = prev.prev;
    }

    if (!notSearchParent) {
        //往上找
        let parent = node.parent;

        while (parent) {
            if (parent instanceof VNode.Element) return;

            let result = getNodePrevInstallPosition(parent, true);

            if (result) return result;

            parent = parent.parent;
        }
    }
    return;
}

// 创建一个自定义元素
class HtmlContainerWebComponent extends HTMLElement {
    root: ShadowRoot;

    constructor() {
        super();

        this.root = this.attachShadow({ mode: "open" });
    }
}

// 注册自定义元素
!customElements.get("joker-html-shadow") && customElements.define("joker-html-shadow", HtmlContainerWebComponent);
