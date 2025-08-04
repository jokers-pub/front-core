import { Component, SCOPE_ID } from "../../src/component";

import { VNode } from "../../src/parser/vnode";
import { getAst, sleep } from "../utils";

class ParentView extends Component {
    model = {
        time: 3,
        test1: ""
    };
    [SCOPE_ID] = "3333";
    template = function (h: any) {
        return getAst(
            `
        <div>
            <demo booleanValue booleanValue2="@false" time='@model.time' p2='2' @v1Change='onChange'>
                <span>1</span>
                @section('s1',v1,){
                    <b>@v1</b>
                }
            </demo>
        </div>
        `
        );
    };

    components = {
        demo: ChildrenView
    };

    onChange(e: VNode.Event<string>) {
        this.model.test1 = e.data!;
    }
}

class ChildrenView extends Component<{ time: number; p2: string; booleanValue: boolean; booleanValue2: boolean }> {
    public model: Record<string | symbol, any> = {
        v1: 1
    };

    template = function (h: any) {
        return getAst(`
        <p class='demo'>
            @props.time + @props.p2
            @RenderSection()

            <span class='self' @click.once.stop="onClick">@RenderSection('s1',model.v1)</span>
        </p>
        @(props.booleanValue && 'XXX')
        @(props.booleanValue2 ? 'YYY':'')
        `);
    };

    onClick() {
        this.model.v1++;

        this.$trigger("v1Change", "aaaaa");
    }
}

class HMRComponent extends Component {
    public template = function (h: any) {
        return getAst(`
      <div>
          <span>@model.time</span>
      </div>
      `);
    };

    model = {
        time: 1
    };

    addTime() {
        this.model.time++;
    }
}

describe("parser-component", () => {
    it("Basic", () => {
        let root = document.createElement("div");

        let view = new ParentView().$mount(root);

        expect(root.innerHTML).toEqual(
            `<div data-scoped-3333=""><p class="demo">3 + 2<span data-scoped-3333="">1</span><span class="self"><b data-scoped-3333="">1</b></span></p>XXX</div>`
        );

        view.model.time = 4;

        expect(root.innerHTML).toEqual(
            `<div data-scoped-3333=""><p class="demo">4 + 2<span data-scoped-3333="">1</span><span class="self"><b data-scoped-3333="">1</b></span></p>XXX</div>`
        );

        let selfEle = root.querySelector(".self");

        (<HTMLSpanElement>selfEle).click();

        expect(root.innerHTML).toEqual(
            `<div data-scoped-3333=""><p class="demo">4 + 2<span data-scoped-3333="">1</span><span class="self"><b data-scoped-3333="">2</b></span></p>XXX</div>`
        );

        expect(view.model.test1).toEqual("aaaaa");

        //once modifier check
        (<HTMLSpanElement>selfEle).click();

        expect(root.innerHTML).toEqual(
            `<div data-scoped-3333=""><p class="demo">4 + 2<span data-scoped-3333="">1</span><span class="self"><b data-scoped-3333="">2</b></span></p>XXX</div>`
        );

        //destroy
        view.$destroy();
        expect(root.innerHTML).toEqual("");
    });

    it("Hot Reload", () => {
        let root = document.createElement("div");

        let view = new HMRComponent().$mount(root);

        view.addTime();

        expect(root.innerHTML).toEqual("<div><span>2</span></div>");

        view.$render(function () {
            return getAst(` <div>
           <b>@model.time</b>
       </div>`);
        });

        expect(root.innerHTML).toEqual("<div><b>2</b></div>");
    });
});
