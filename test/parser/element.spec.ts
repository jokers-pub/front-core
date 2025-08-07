import { Component } from "../../src/component";
import { VNode } from "../../src/parser/vnode";
import { mountAst, sleep } from "../utils";

class Source extends Component {
    model = {
        attr1: "Test once",
        attr2: 3,
        class1: "v3",
        booleanVal: false
    };

    event1() {
        this.model.class1 = "event1";
    }
    event2(e: VNode.Event, param: string) {
        this.model.class1 = param || "";
    }
}

describe("parser-element", () => {
    it("Basic", () => {
        let data = new Source();

        let root = mountAst(
            `<div target="@model.booleanVal" name="@model.attr1" age="@(model.attr2+1)" class= "className @model.class1" @click="event1" @tap="event2(2)">123</div>`,
            data
        );

        expect(root.innerHTML).toEqual(`<div name="Test once" age="4" class="className v3">123</div>`);

        let div = root.querySelector("div")!;

        div.click();

        expect(root.innerHTML).toEqual(`<div name="Test once" age="4" class="className event1">123</div>`);

        div.dispatchEvent(new CustomEvent("tap"));

        expect(root.innerHTML).toEqual(`<div name="Test once" age="4" class="className 2">123</div>`);

        data.model.attr1 = "Test twice";

        expect(root.innerHTML).toEqual(`<div name="Test twice" age="4" class="className 2">123</div>`);
    });

    it("Optimize class value spaces", () => {
        let data = new Source();

        let root = mountAst(`<div a="s  s     s  " class="s  s     s  ">123</div>`, data);

        expect(root.innerHTML).toEqual(`<div a="s  s     s" class="s s s">123</div>`);
    });

    it("Combined dynamic attributes", () => {
        let data = new Source();

        let root = mountAst(`<div name=" @model.attr1 hh@model.attr1 @(model.attr2)"></div>`, data);

        expect(root.innerHTML).toEqual(`<div name="Test once hhTest once 3"></div>`);
    });

    it("Empty method", () => {
        let data = new Source();

        expect(() => mountAst(`<div @keydown.stop>123</div>`, data)).not.toThrow();
    });

    it("class style syntactic sugar", () => {
        let data = new Source();

        let root = mountAst(
            `<div class="@([
            'ssss',
            (model.booleanVal?'booleanVal':''),
            {
                'self-attr':model.booleanVal,
                'custom-attr':true
            }
        ])" style="@({color:'red',display:model.booleanVal?'none':'block'})"></div>`,
            data
        );

        expect(root.innerHTML).toEqual('<div class="ssss custom-attr" style="color: red; display: block;"></div>');

        root.querySelector("div")!.style.height = "300px";

        expect(root.innerHTML).toEqual(
            '<div class="ssss custom-attr" style="color: red; display: block; height: 300px;"></div>'
        );

        data.model.booleanVal = true;

        expect(root.innerHTML).toEqual(
            '<div class="ssss booleanVal self-attr custom-attr" style="color: red; display: none;"></div>'
        );
    });
});