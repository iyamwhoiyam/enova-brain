// Production build: precompile the in-browser JSX to plain JS and drop babel-standalone.
// The app's <script type="text/babel" data-presets="react"> is transformed with the SAME
// preset (@babel/preset-react, classic runtime) the regression harness already validates,
// so behavior is identical — but the browser no longer downloads Babel (~2.8 MB) or eval-
// compiles on every load. Output: index.prod.html (this is what deploys as index.html).
//   Run:  node build_prod.js
// Portable: resolves paths relative to this file and Babel from local node_modules (CI) or
// the global path (dev sandbox), so it runs in GitHub Actions and at /root unchanged.
const fs = require("fs");
const path = require("path");
const os = require("os");
const ROOT = __dirname;
const NG = process.env.ENOVA_NG || "/home/claude/.npm-global/lib/node_modules";
const reqMod   = (name) => { try { return require(name); } catch (_) { return require(NG + "/" + name); } };
const resolveMod = (name) => { try { return require.resolve(name); } catch (_) { return NG + "/" + name; } };
const babel = reqMod("@babel/core");
const presetReact = resolveMod("@babel/preset-react");

const SRC = process.env.ENOVA_SRC || path.join(ROOT, "Enova_Brain_Studio_2.html");
const OUT = process.env.ENOVA_PROD_OUT || path.join(ROOT, "index.prod.html");
let html = fs.readFileSync(SRC, "utf8");

const m = html.match(/<script type="text\/babel" data-presets="react">([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: could not find the text/babel app block"); process.exit(1); }

const compiled = babel.transformSync(m[1], {
  presets: [[presetReact, { runtime: "classic" }]],
  filename: "app.jsx", sourceType: "script", compact: false,
}).code;

// IMPORTANT: use a FUNCTION replacer, not a string. The compiled code contains "$'", "$&",
// and "$`" sequences (e.g. the MFSO price formatting `'$'+Number(...)`), which String.replace
// interprets as special patterns in a *string* replacement — silently corrupting the output
// (this white-screened index.prod.html until caught by the browser render harness). A function
// return value is inserted verbatim, immune to $-pattern expansion.
const injected = '<script id="enova-app-compiled">\n' + compiled + '\n</script>';
let prod = html.replace(m[0], () => injected);
// babel-standalone is only needed to compile JSX at runtime — remove it from prod.
prod = prod.replace(/\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"><\/script>/, '');
fs.writeFileSync(OUT, prod);

// Verify: the compiled script is syntactically valid, and no runtime-Babel remains.
const tmpApp = path.join(os.tmpdir(), "_prod_app.js");
const tmpInj = path.join(os.tmpdir(), "_prod_injected.js");
fs.writeFileSync(tmpApp, compiled);
require("child_process").execSync('node --check "' + tmpApp + '"');
// Verify the INJECTED block too — re-extract from the written HTML and parse it, so any future
// inlining corruption (like the $-pattern bug above) fails the build instead of shipping.
{
  const w = fs.readFileSync(OUT, "utf8");
  const a = w.indexOf('<script id="enova-app-compiled">');
  const bs = w.indexOf(">", a) + 1, be = w.indexOf("</script>", bs);
  fs.writeFileSync(tmpInj, w.slice(bs, be));
  require("child_process").execSync('node --check "' + tmpInj + '"');
}
const issues = [];
if (/type="text\/babel"/.test(prod)) issues.push("text/babel still present");
if (/babel-standalone/.test(prod)) issues.push("babel-standalone still present");
if (!/react\.development\.js|react\.production\.min\.js/.test(prod)) issues.push("React not loaded");

console.log("index.prod.html:", (prod.length/1024).toFixed(0) + "KB (source was " + (html.length/1024).toFixed(0) + "KB)");
console.log("compiled app JS parses: OK (" + (compiled.length/1024).toFixed(0) + "KB)");
console.log("in-browser Babel removed:", !/babel-standalone/.test(prod), "| JSX precompiled:", !/type="text\/babel"/.test(prod));
if (issues.length) { console.log("ISSUES:", issues.join(", ")); process.exit(1); }
console.log("PROD BUILD OK.");
