#!/usr/bin/env node
/* Portable CI gate for Enova Brain — proves the deploy file is shippable.
 * Dependencies: @babel/core + @babel/preset-react ONLY. No absolute paths, no browser,
 * no /root assumptions — runs in GitHub Actions or any checkout. It guarantees the three
 * things that would white-screen a Vercel deploy:
 *   1) index.html's JSX actually compiles (the Babel-standalone app fails silently otherwise),
 *   2) its braces/brackets/parens are balanced,
 *   3) index.html is byte-for-byte the source (so we never deploy a stale build).
 * The full behavioral + browser suite (run_all_tests.sh) runs in the dev harness; this is the gate.
 */
const fs = require("fs");
const babel = require("@babel/core");
const presetReact = require.resolve("@babel/preset-react");

const DEPLOY = "index.html";
const SOURCE = "Enova_Brain_Studio_2.html";

let fail = 0;
const check = (name, ok, detail) => { console.log((ok ? "  ✓ " : "  ✗ ") + name + (detail ? "  " + detail : "")); if (!ok) fail++; };

function extractBabel(html) {
  const m = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script type="text/babel"> block found in ' + DEPLOY);
  return m[1];
}
function balance(s) {
  let b = 0, k = 0, p = 0;
  for (const c of s) {
    if (c === "{") b++; else if (c === "}") b--;
    else if (c === "[") k++; else if (c === "]") k--;
    else if (c === "(") p++; else if (c === ")") p--;
  }
  return { b, k, p };
}

if (!fs.existsSync(DEPLOY)) { console.log("FATAL: " + DEPLOY + " not found in repo root"); process.exit(2); }
const html = fs.readFileSync(DEPLOY, "utf8");
const lines = html.split("\n").length;

let code;
try { code = extractBabel(html); }
catch (e) { console.log("FATAL: " + e.message); process.exit(2); }

// 1) Babel parse / transform (classic runtime = what Babel-standalone uses in the browser)
let parsed = false;
try {
  babel.transformSync(code, { presets: [[presetReact, { runtime: "classic" }]], filename: "app.jsx", sourceType: "script" });
  parsed = true;
} catch (e) {
  check("Babel parse (index.html)", false, (e.message || "").split("\n")[0]);
}
if (parsed) check("Babel parse (index.html)", true, "OK · " + lines.toLocaleString() + " lines");

// 2) Script-scoped balance must be perfectly even
const { b, k, p } = balance(code);
check("script balance 0/0/0", b === 0 && k === 0 && p === 0, "braces " + b + " · brackets " + k + " · parens " + p);

// 3) Deploy file must equal the source (guards against shipping a stale build)
if (fs.existsSync(SOURCE)) {
  const same = fs.readFileSync(SOURCE, "utf8") === html;
  check("index.html == source (byte-for-byte)", same, same ? "" : "run: cp " + SOURCE + " index.html");
} else {
  console.log("  • source " + SOURCE + " not in repo — skipping deploy-sync check");
}

console.log(fail ? "\n" + fail + " CHECK(S) FAILED — do not deploy." : "\nCI VERIFY PASSED — safe to deploy.");
process.exit(fail ? 1 : 0);
