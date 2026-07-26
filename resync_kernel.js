const fs = require("fs");
const F = "Enova_Brain_Studio_2.html";
let html = fs.readFileSync(F, "utf8");
const kernel = fs.readFileSync("enova_brain.js", "utf8").replace(/\s+$/,"");
const re = /<script id="enova-brain">[\s\S]*?<\/script>/;
if (!re.test(html)) { console.log("BLOCK NOT FOUND — aborting"); process.exit(2); }
const block = '<script id="enova-brain">\n' + kernel + '\n</script>';
// FUNCTION replacer (§30 standing rule): the kernel source can contain `$&`/`$'`/`$1` sequences
// (e.g. the label engine's regex-escape "\\$&"), which String.replace would interpret as special
// replacement patterns and corrupt/duplicate the block. A function replacer inserts `block` verbatim.
html = html.replace(re, () => block);
fs.writeFileSync(F, html);
console.log("RESYNCED. total lines:", html.split("\n").length);
// prove the embedded copy now matches the source (extract + compare the JS body)
const emb = html.match(/<script id="enova-brain">\n([\s\S]*?)\n<\/script>/)[1];
console.log("embedded === source:", emb === kernel);
console.log("has import-stub guard:", /decomposed = cb\.activeCPU != null/.test(emb));
