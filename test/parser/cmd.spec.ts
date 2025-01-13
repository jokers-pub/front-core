import { remove, sleep } from "@joker.front/shared";
import { registerGlobalFunction } from "../../src";
import { Component } from "../../src/component";
import { mountAst } from "../utils";

describe("parser-cmd", () => {
    class Source extends Component {
        model = {
            time: "0",
            ifr: 0,
            arr: [1, 2, 3, 4, 5],
            arr2: [
                { name: "1", value: [1, 2, 3, 4] },
                { name: "2", value: [3, 4, 5, 6] }
            ]
        };

        test() {
            return this.model.time + "1";
        }
    }
    it("基础Html", () => {
        let data = new Source();

        let root = mountAst(`<div>@model.time @Html(model.time)</div>`, data);

        expect(root.innerHTML).toEqual('<div>0<joker-html-shadow style="line-height: 1;"></joker-html-shadow></div>');

        root = mountAst(`<div>@Html(test())</div>`, data);

        expect(root.innerHTML).toEqual('<div><joker-html-shadow style="line-height: 1;"></joker-html-shadow></div>');

        root = mountAst(`<div>@test()</div>`, data);

        expect(root.innerHTML).toEqual("<div>01</div>");

        registerGlobalFunction({
            test: (a: string, b: string) => {
                return a + b;
            }
        });

        root = mountAst(`<div>@Global.test('3',model.time)</div>`, data);

        expect(root.innerHTML).toEqual("<div>30</div>");
    });

    it("if", () => {
        let data = new Source();

        let root = mountAst(
            `
                @if(model.ifr===0){
                    <div>1</div>
                }
                else if(model.ifr===1){
                    <div>2</div>
                }
                else{
                    <div>3</div>
                }
            `,
            data
        );

        expect(root.innerHTML).toEqual("<div>1</div>");

        data.model.ifr = 1;
        expect(root.innerHTML).toEqual("<div>2</div>");

        data.model.ifr = 2;
        expect(root.innerHTML).toEqual("<div>3</div>");

        root = mountAst(
            `
                @if(!model.arr){
                   
                }
                else{
                    @if(model.arr.length){
                        <span>1</span>
                    }
                }
            `,
            data
        );

        expect(root.innerHTML).toEqual("<span>1</span>");

        //@ts-ignore
        data.model.arr = undefined;
        expect(root.innerHTML).toEqual("");
    });

    it("if-测试相邻if互不影响", () => {
        let data1 = new Source();
        let root1 = mountAst(
            `
                @if(true){
                    <div>-1</div>
                }
                else{
                    <div>0</div>
                }
                @if(model.ifr===0){
                    <div>1</div>
                }
                else if(model.ifr===1){
                    <div>2</div>
                }
                else{
                    <div>3</div>
                }
            `,
            data1
        );

        expect(root1.innerHTML).toEqual("<div>-1</div><div>1</div>");

        data1.model.ifr = 1;

        expect(root1.innerHTML).toEqual("<div>-1</div><div>2</div>");

        data1.model.ifr = 2;

        expect(root1.innerHTML).toEqual("<div>-1</div><div>3</div>");
    });

    it("for", async () => {
        let data = new Source();

        let root = mountAst(
            ` @for(let item of model.arr){
            <p>@item</p>
        }`,
            data
        );

        expect(root.innerHTML).toEqual(`<p>1</p><p>2</p><p>3</p><p>4</p><p>5</p>`);

        data.model.arr.push(6);

        expect(root.innerHTML).toEqual(`<p>1</p><p>2</p><p>3</p><p>4</p><p>5</p><p>6</p>`);

        data.model.arr.pop();

        expect(root.innerHTML).toEqual(`<p>1</p><p>2</p><p>3</p><p>4</p><p>5</p>`);

        data.model.arr = [6, 5, 4, 3];

        expect(root.innerHTML).toEqual(`<p>6</p><p>5</p><p>4</p><p>3</p>`);

        data.model.arr.splice(1, 0, 1);

        expect(root.innerHTML).toEqual(`<p>6</p><p>1</p><p>5</p><p>4</p><p>3</p>`);

        data.model.arr[0] = 0;
        await Promise.resolve();
        expect(root.innerHTML).toEqual(`<p>0</p><p>1</p><p>5</p><p>4</p><p>3</p>`);

        remove(data.model.arr, 5);

        expect(root.innerHTML).toEqual(`<p>0</p><p>1</p><p>4</p><p>3</p>`);

        data.model.arr.push(6);
        data.model.arr.push(7);

        expect(root.innerHTML).toEqual(`<p>0</p><p>1</p><p>4</p><p>3</p><p>6</p><p>7</p>`);
    });

    it("嵌套循环", () => {
        let data = new Source();

        let root = mountAst(
            ` @for(let item of model.arr2){
            <p>@item.name</p>
            @for(let c of item.value){
                @(item.name+c)
            }
        }`,
            data
        );

        expect(root.innerHTML).toEqual(`<p>1</p>11121314<p>2</p>23242526`);
    });
});
