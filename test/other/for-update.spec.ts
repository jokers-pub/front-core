import { moveDown, moveUp, remove, removeFilter } from "@joker.front/shared";
import { combinedReply, Component, VNode } from "../../src";
import { getAst } from "../utils";

describe("FOR循环更新测试", () => {
    it("基础", async () => {
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
    });

    it("带索引", () => {
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
});
