import { Component } from "../../src";
import { getAst, sleep } from "../utils";

describe("for-async", () => {
    it("基础", async () => {
        class ParentView extends Component {
            template = function () {
                return getAst(`
                @for(let item of model.arr){
                    <ChildrenView param="@item" />
                }
                `);
            };
            model = {
                arr: [1, 2, 3, 4, 5]
            };
            components = {
                ChildrenView
            };
        }

        class ChildrenView extends Component<{ param: string }> {
            template = function () {
                return getAst(`
                <span>@props.param</span>
                `);
            };
            async mounted() {
                await sleep(10);
            }
        }

        let root = document.createElement("div");
        let component = await new ParentView().$mount(root);

        expect(root.innerHTML).toEqual("<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>");
        component.model.arr.splice(2, 0, 6);
        await component.$updatedRender();
        expect(root.innerHTML).toEqual(
            "<span>1</span><span>2</span><span>6</span><span>3</span><span>4</span><span>5</span>"
        );
    });

    it("for循环下的if", async () => {
        class View extends Component {
            template = function () {
                return getAst(`
                @for(let item of model.arr){
                    @if(item===2){
                        <span>1</span>
                    }
                    else{
                        <span>2</span>
                    }
                    <i />
                }    
                `);
            };
            model = {
                arr: [1, 2, 3, 4, 5]
            };
        }

        let root = document.createElement("div");
        let component = await new View().$mount(root);

        expect(root.innerHTML).toEqual(
            "<span>2</span><i></i><span>1</span><i></i><span>2</span><i></i><span>2</span><i></i><span>2</span><i></i>"
        );
        component.model.arr = [2, 2, 2, 2, 2];
        component.model.arr = [1, 2, 3, 4, 5];

        await component.$updatedRender();

        expect(root.innerHTML).toEqual(
            "<span>2</span><i></i><span>1</span><i></i><span>2</span><i></i><span>2</span><i></i><span>2</span><i></i>"
        );
    });
});
