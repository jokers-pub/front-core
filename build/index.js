const { rollup } = require("rollup");
const typescript = require("rollup-plugin-typescript2");
const commonjs = require("@rollup/plugin-commonjs");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const jsonPlugin = require("@rollup/plugin-json");
const path = require("node:path");
const fs = require("node:fs");
const terser = require("@rollup/plugin-terser");
let args = {};

for (let i = 2; i < process.argv.length; i++) {
    let item = process.argv[i];

    let params = item.split("=");

    let name = params[0].replace(/\-\-/, "").trim();

    args[name] = params[1] || "";
}

let pkgJsonPath = path.join(process.cwd(), "package.json");

let external = [];
let pkg = {};
if (fs.existsSync(pkgJsonPath)) {
    try {
        pkg = JSON.parse(fs.readFileSync(pkgJsonPath).toString("utf-8"));

        external = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.peerDependencies || {})];
    } catch (e) {}
}

let inputEntry = args.input ? path.join(process.cwd(), args.input) : path.join(process.cwd(), "src", "index.ts");

const inputOptions = {
    input: inputEntry,
    external,
    plugins: [
        nodeResolve(),
        commonjs({
            // Resolve scenarios with non-static requires (Could not dynamically require)
            ignoreDynamicRequires: true
        }),
        jsonPlugin(),
        typescript({
            tsconfig: path.join(process.cwd(), "tsconfig.json"),
            clean: true,
            useTsconfigDeclarationDir: true
        })
    ]
};

if ("terser" in args) {
    inputOptions.plugins.push(terser());
}

const esOutputOptions = {
    sourcemap: args.sourcemap !== "false",
    file: path.resolve("dist", (args.output || "bundle") + ".es.js"),
    format: "es"
};

const cjsOutputOptions = {
    sourcemap: args.sourcemap !== "false",
    file: path.resolve("dist", (args.output || "bundle") + ".js"),
    format: "cjs"
};

function cleanDist() {
    const distPath = path.resolve("dist");

    // 直接删除整个dist目录（包括内容）
    if (fs.existsSync(distPath)) {
        fs.rmSync(distPath, { recursive: true, force: true });
    }

    // 确保dist目录存在
    fs.mkdirSync(distPath, { recursive: true });
}

async function build() {
    cleanDist();
    // Create a separate bundle for ES format
    if (!args.format || args.format === "es") {
        const esBundle = await rollup({
            ...inputOptions,
            inlineDynamicImports: true // Ensure only one file is generated
        });
        await esBundle.write(esOutputOptions);

        await esBundle.close();
    }

    // Create a separate bundle for CJS format
    if (!args.format || args.format === "cjs") {
        const cjsBundle = await rollup({
            ...inputOptions,
            inlineDynamicImports: true // Ensure only one file is generated
        });
        await cjsBundle.write(cjsOutputOptions);

        await cjsBundle.close();
    }

    console.log("build complete");
}

build();
