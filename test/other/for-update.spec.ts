import { moveDown, moveUp, remove, removeFilter } from "@joker.front/shared";
import { combinedReply, Component, VNode } from "../../src";
import { getAst } from "../utils";

describe("FOR loop update test", () => {
    it("Basic", async () => {
        class View extends Component {
            model = {
                list: [{ id: 1 }, { id: 2 }, { id: 3 }]
            };
            template = function () {
                return getAst(`
                    @for(let item of model.list){
                       <span>@item.id</span>
                    }
                `);
            };
        }

        let root = document.createElement("div");
        let component = new View();

        component.$mount(root);
        expect(root.innerHTML).toEqual("<span>1</span><span>2</span><span>3</span>");

        moveUp(component.model.list, 1);
        await Promise.resolve();
        expect(root.innerHTML).toEqual("<span>2</span><span>1</span><span>3</span>");

        component.model.list.push({ id: 5 });
        expect(root.innerHTML).toEqual("<span>2</span><span>1</span><span>3</span><span>5</span>");

        component.model.list.unshift({ id: 0 });
        expect(root.innerHTML).toEqual("<span>0</span><span>2</span><span>1</span><span>3</span><span>5</span>");

        root.lastElementChild!.innerHTML = "x";
        expect(root.innerHTML).toEqual("<span>0</span><span>2</span><span>1</span><span>3</span><span>x</span>");

        component.model.list.shift();
        expect(root.innerHTML).toEqual("<span>2</span><span>1</span><span>3</span><span>x</span>");

        moveUp(component.model.list, 2);

        await Promise.resolve();
        expect(root.innerHTML).toEqual("<span>2</span><span>3</span><span>1</span><span>x</span>");
        combinedReply(() => {
            removeFilter(component.model.list, (n) => n.id === 1);
            removeFilter(component.model.list, (n) => n.id === 3);
        });

        expect(root.innerHTML).toEqual("<span>2</span><span>x</span>");

        component.model.list.unshift({ id: 0 });
        expect(root.innerHTML).toEqual("<span>0</span><span>2</span><span>x</span>");

        component.model.list.splice(2, 0, { id: 3 });

        expect(root.innerHTML).toEqual("<span>0</span><span>2</span><span>3</span><span>x</span>");

        remove(component.model.list, component.model.list[component.model.list.length - 1]);

        expect(root.innerHTML).toEqual("<span>0</span><span>2</span><span>3</span>");

        component.model.list[0] = { id: 333 };
        await Promise.resolve();
        expect(root.innerHTML).toEqual("<span>333</span><span>2</span><span>3</span>");
        component.model.list.push({ id: 4 });

        moveDown(component.model.list, 0);
        await Promise.resolve();
        expect(root.innerHTML).toEqual("<span>2</span><span>333</span><span>3</span><span>4</span>");

        moveDown(component.model.list, 0);
        await Promise.resolve();
        expect(root.innerHTML).toEqual("<span>333</span><span>2</span><span>3</span><span>4</span>");

        moveUp(component.model.list, 1);
        await Promise.resolve();
        expect(root.innerHTML).toEqual("<span>2</span><span>333</span><span>3</span><span>4</span>");

        let item = component.model.list[2];
        component.model.list.splice(0, 0, item);
        await component.$nextUpdatedRender();
        expect(root.innerHTML).toEqual("<span>3</span><span>2</span><span>333</span><span>3</span><span>4</span>");
    });

    it("With Index", () => {
        class View extends Component {
            model = {
                list: [{ id: 1 }, { id: 2 }, { id: 3 }]
            };
            template = function () {
                return getAst(`
                    @for(let (index,item) in model.list){
                       <span>@item.id</span>
                    }
                `);
            };
        }

        let root = document.createElement("div");
        let component = new View();
        component.$mount(root);

        root.lastElementChild!.innerHTML = "x";
        expect(root.innerHTML).toEqual("<span>1</span><span>2</span><span>x</span>");

        component.model.list.shift();
        expect(root.innerHTML).toEqual("<span>2</span><span>x</span>");
    });

    it("Mixed Mode", async () => {
        class View extends Component {
            model = {
                list: [{ id: 1 }, { id: 2 }, { id: 3 }]
            };
            template = function () {
                return getAst(`
                <ul>
                    <li>0</li>
                    @if(model.list.length){
                        @for(let (index,item) in model.list){
                            <li>@item.id</li>
                        }
                    }
                </ul>
                `);
            };
        }

        let root = document.createElement("div");
        let component = new View();
        component.$mount(root);

        expect(root.innerHTML).toEqual("<ul><li>0</li><li>1</li><li>2</li><li>3</li></ul>");

        component.model.list.shift();
        expect(root.innerHTML).toEqual("<ul><li>0</li><li>2</li><li>3</li></ul>");

        component.model.list[0].id = 9;
        expect(root.innerHTML).toEqual("<ul><li>0</li><li>9</li><li>3</li></ul>");

        component.model.list = [{ id: 8 }, { id: 7 }];
        expect(root.innerHTML).toEqual("<ul><li>0</li><li>8</li><li>7</li></ul>");

        moveUp(component.model.list, 1);
        await component.$nextUpdatedRender();
        expect(root.innerHTML).toEqual("<ul><li>0</li><li>7</li><li>8</li></ul>");
    });
});