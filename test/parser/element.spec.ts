import { Component } from "../../src/component";
import { VNode } from "../../src/parser/vnode";
import { mountAst, sleep } from "../utils";

class Source extends Component {
    model = {
        attr1: "测试一下",
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
    it("基础", async () => {
        let data = new Source();

        let root = await mountAst(
            `<div target="@model.booleanVal" name="@model.attr1" age="@(model.attr2+1)" class= "className @model.class1" @click="event1" @tap="event2(2)">123</div>`,
            data
        );

        expect(root.innerHTML).toEqual(`<div name="测试一下" age="4" class="className v3">123</div>`);

        let div = root.querySelector("div")!;

        div.click();

        await data.$updatedRender();
        expect(root.innerHTML).toEqual(`<div name="测试一下" age="4" class="className event1">123</div>`);

        div.dispatchEvent(new CustomEvent("tap"));
        await data.$updatedRender();
        expect(root.innerHTML).toEqual(`<div name="测试一下" age="4" class="className 2">123</div>`);

        data.model.attr1 = "测试两下";
        await data.$updatedRender();
        expect(root.innerHTML).toEqual(`<div name="测试两下" age="4" class="className 2">123</div>`);
    });

    it("优化class值空格", async () => {
        let data = new Source();

        let root = await mountAst(`<div a="s  s     s  " class="s  s     s  ">123</div>`, data);

        expect(root.innerHTML).toEqual(`<div a="s  s     s" class="s s s">123</div>`);
    });

    it("组合动态属性", async () => {
        let data = new Source();

        let root = await mountAst(`<div name=" @model.attr1 hh@model.attr1 @(model.attr2)"></div>`, data);

        expect(root.innerHTML).toEqual(`<div name="测试一下 hh测试一下 3"></div>`);
    });

    it("空载方法", () => {
        let data = new Source();

        expect(() => mountAst(`<div @keydown.stop>123</div>`, data)).not.toThrow();
    });

    it("class style 语法糖", async () => {
        let data = new Source();

        let root = await mountAst(
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
        await data.$updatedRender();
        expect(root.innerHTML).toEqual(
            '<div class="ssss booleanVal self-attr custom-attr" style="color: red; display: none;"></div>'
        );
    });
});
