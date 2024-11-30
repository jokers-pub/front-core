import { Component } from "../../src";
import { getAst } from "../utils";

describe("render", () => {
    it("append-to-element验证", async () => {
        class View extends Component {
            model = {
                show: false
            };

            template = function (h: any) {
                return getAst(`
                    <div class="container">
                        <p append-to='body'>1</p>

                        @if(model.show){
                            <p append-to='body'>2</p>
                            <p>3</p>
                        }
                        <p>4</p>
                    </div>
                    <p append-to='body'>5</p>
                    <p>6</p>
                `);
            };
        }

        let root = document.createElement("div");
        document.body.appendChild(root);

        let component = await new View().$mount(root);

        expect(document.body.innerHTML).toEqual(
            '<div><div class="container"><p>4</p></div><p>6</p></div><p append-to="body">1</p><p append-to="body">5</p>'
        );

        component.model.show = true;
        await component.$updatedRender();
        expect(document.body.innerHTML).toEqual(
            '<div><div class="container"><p>3</p><p>4</p></div><p>6</p></div><p append-to="body">1</p><p append-to="body">5</p><p append-to="body">2</p>'
        );

        component.$destroy(true);
        expect(document.body.innerHTML).toEqual("<div></div>");
    });

    it("append-to-component验证", async () => {
        document.body.innerHTML = "";
        class View extends Component {
            model = {
                show: false
            };
            components = {
                View2
            };
            template = function (h: any) {
                return getAst(`
                    <div class="container">
                        <View2 append-to='body'>1</View2>

                        @if(model.show){
                            <View2 append-to='body'>2</View2>
                            <View2>3</View2>
                        }
                        <View2>4</View2>
                    </div>
                    <View2 append-to='body'>5</View2>
                    <View2>6</View2>
                `);
            };
        }

        class View2 extends Component {
            template = function (h: any) {
                return getAst(`
                    <p>@RenderSection()</p>
                `);
            };
        }

        let root = document.createElement("div");
        document.body.appendChild(root);

        let component = await new View().$mount(root);

        expect(document.body.innerHTML).toEqual(
            '<div><div class="container"><p>4</p></div><p>6</p></div><p>1</p><p>5</p>'
        );

        component.model.show = true;

        await component.$updatedRender();
        expect(document.body.innerHTML).toEqual(
            '<div><div class="container"><p>3</p><p>4</p></div><p>6</p></div><p>1</p><p>5</p><p>2</p>'
        );

        component.$destroy(true);
        expect(document.body.innerHTML).toEqual("<div></div>");
    });
});
