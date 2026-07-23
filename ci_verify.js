#!/usr/bin/env node
/* Portable CI gate for the PRECOMPILED deploy.
 * index.html is the production build (JSX precompiled ahead of time, no in-browser Babel — so the
 * page loads faster and prints no Babel console warnings). This gate:
 *   1) runs build_prod.js, which compiles the source's JSX (fails on ANY parse error) and writes
 *      index.prod.html,
 *   2) asserts index.html is byte-for-byte that fresh build (never deploy a stale or hand-edited one),
 *   3) confirms the deploy really is precompiled (no text/babel, no babel-standalone).
 * Deps: @babel/core + @babel/preset-react (used by build_prod.js). No browser, no /root assumptions.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT   = __dirname;
const DEPLOY = path.join(ROOT, "index.html");
const PROD   = path.join(ROOT, "index.prod.html");
const SOURCE = path.join(ROOT, "Enova_Brain_Studio_2.html");

let fail = 0;
const check = (name, ok, detail) => { console.log((ok ? "  ✓ " : "  ✗ ") + name + (detail ? "  " + detail : "")); if (!ok) fail++; };

if (!fs.existsSync(DEPLOY)) { console.log("FATAL: index.html not found in repo root"); process.exit(2); }
if (!fs.existsSync(SOURCE)) { console.log("FATAL: source Enova_Brain_Studio_2.html not found (needed to build)"); process.exit(2); }

// 1) Build from source. build_prod compiles the JSX and exits non-zero on any error → compile gate.
let built = false;
try { execSync('node "' + path.join(ROOT, "build_prod.js") + '"', { cwd: ROOT, stdio: "pipe" }); built = true; }
catch (e) { check("source compiles (build_prod)", false, (((e.stdout || e.message || e) + "").split("\n").slice(-3).join(" ")).slice(0, 200)); }
if (built) check("source compiles (build_prod)", true, "JSX → JS, babel-standalone dropped");

// 2) Deploy file must equal the fresh build.
if (built) {
  const same = fs.readFileSync(DEPLOY, "utf8") === fs.readFileSync(PROD, "utf8");
  check("index.html == fresh prod build", same, same ? "" : "run: node build_prod.js && cp index.prod.html index.html");
}

// 3) Deploy must actually be precompiled.
const html = fs.readFileSync(DEPLOY, "utf8");
const lines = html.split("\n").length;
check("no in-browser Babel in deploy", !/type="text\/babel"/.test(html) && !/babel-standalone/.test(html), lines.toLocaleString() + " lines");
check("compiled app present", /id="enova-app-compiled"/.test(html), "");

console.log(fail ? "\n" + fail + " CHECK(S) FAILED — do not deploy." : "\nCI VERIFY PASSED — precompiled deploy is current & clean.");
process.exit(fail ? 1 : 0);
