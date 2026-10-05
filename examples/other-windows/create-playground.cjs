// Build a Svelte Playground URL without publishing a package or depending on its private save API.
// Before release the example embeds the exact local build. After release, --published uses the latest npm version.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const published = process.argv.includes("--published");
const outputIndex = process.argv.indexOf("--output");
const files = ["App", "Lists"].map(name => ({
    name,
    type: "svelte",
    source: fs.readFileSync(path.join(__dirname, `${name}.svelte`), "utf8")
}));
if (!published) files[1].source = files[1].source.replace('from "svelte-dnd-action"', 'from "./dnd.js"');
if (!published) {
    files.push({name: "dnd", type: "js", source: fs.readFileSync(path.join(__dirname, "../../dist/index.mjs"), "utf8")});
}
const state = {name: `Zones in other windows${published ? "" : " (0.9.80 release preview)"}`, files};
const encoded = zlib.gzipSync(JSON.stringify(state)).toString("base64url");
const url = `https://svelte.dev/playground?version=4.2.20#${encoded}`;
if (outputIndex !== -1) {
    fs.writeFileSync(process.argv[outputIndex + 1], url);
    console.log(`Generated ${published ? "npm" : "local-build"} playground URL (${url.length} characters).`);
} else {
    console.log(url);
}
