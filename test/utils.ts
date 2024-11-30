import { TemplateCompile } from "@joker.front/sfc";
import { ParserTemplate, RENDER_HANDLER } from "../src";
import { ObType } from "../src/parser";

export function getAst(template: string) {
    let astStr = new TemplateCompile(template, {
        keepComment: true
    }).renderStr;

    let asts = new Function("h", "return" + astStr)(RENDER_HANDLER);

    return asts;
}

export async function mountAst(template: string, ob: ObType) {
    let root = document.createElement("div");

    ob.$mount(root);
    let astStr = new TemplateCompile(template, {
        keepComment: true
    }).renderStr;

    let asts = new Function("h", "return" + astStr)(RENDER_HANDLER);

    let templates = new ParserTemplate(asts, ob);
    await templates.parser();
    templates.mount(root);

    return root;
}

export async function sleep(timer = 1000) {
    return await new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, timer);
    });
}
