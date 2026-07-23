// Build a fully self-contained, OFFLINE-renderable copy of the app for the pre-installed headless
// Chromium (cdnjs/jsdelivr are blocked in the sandbox). Starts from the precompiled prod build
// (no in-browser Babel), then inlines local UMD copies of React/ReactDOM/xlsx/decimal and stubs
// mammoth. Supabase is intentionally NOT loaded → `sb` is null → Root renders <App/> directly in
// offline/admin mode against the embedded seed + inventory. Output: index.offline.html.
//   Run:  node build_prod.js && node build_offline.js
const fs = require("fs");
const NG = process.env.ENOVA_NG || "/home/claude/.npm-global/lib/node_modules";
const read = (p) => fs.readFileSync(p, "utf8");

let html = read("/root/index.prod.html");
// Inlining a JS blob that contains the literal "</script>" (React-DOM & XLSX dev builds do, inside
// strings) would prematurely close the HTML <script> element and throw "Invalid or unexpected
// token". Escape it — the browser un-escapes "<\/script>" back to "</script>" at runtime.
const inlineScript = (js) => `<script>\n${js.replace(/<\/(script)/gi, "<\\/$1")}\n</script>`;

// Map each remote <script src="..."> to a local inline replacement (or a stub / removal).
const REACT   = read("/root/node_modules/react/umd/react.development.js");
const REACTDOM = read("/root/node_modules/react-dom/umd/react-dom.development.js");
const XLSX    = read(NG + "/xlsx/dist/xlsx.full.min.js");
const DECIMAL = read(NG + "/decimal.js/decimal.js");

const repl = [
  [/<script[^>]*\bsrc="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/react\/[^"]+"><\/script>/,        inlineScript(REACT)],
  [/<script[^>]*\bsrc="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/react-dom\/[^"]+"><\/script>/,    inlineScript(REACTDOM)],
  [/<script[^>]*\bsrc="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/[^"]+"><\/script>/,         inlineScript(XLSX)],
  [/<script[^>]*\bsrc="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/mammoth\/[^"]+"><\/script>/,      inlineScript("window.mammoth={convertToHtml:()=>Promise.resolve({value:'',messages:[]}),extractRawText:()=>Promise.resolve({value:'',messages:[]})};")],
  [/<script[^>]*\bsrc="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/decimal\.js\/[^"]+"><\/script>/,  inlineScript(DECIMAL)],
  [/<script[^>]*\bsrc="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/[^"]+"><\/script>/,               "<!-- supabase intentionally omitted → offline mode -->"],
];

const missing = [];
for (const [re, out] of repl) {
  if (!re.test(html)) { missing.push(re.source.slice(0, 60)); continue; }
  html = html.replace(re, () => out);
}
// Any leftover remote <script src> would fail to load offline and leave a blank page — fail loud.
const leftover = (html.match(/<script[^>]*\bsrc="https?:\/\/[^"]+"/g) || []);
fs.writeFileSync("/root/index.offline.html", html);

console.log("index.offline.html:", (html.length / 1024 / 1024).toFixed(2) + "MB");
console.log("inlined: react", (REACT.length/1024|0)+"KB · react-dom", (REACTDOM.length/1024|0)+"KB · xlsx", (XLSX.length/1024|0)+"KB · decimal", (DECIMAL.length/1024|0)+"KB");
if (missing.length) { console.log("WARN: patterns not found:", missing.join(" | ")); }
if (leftover.length) { console.log("FAIL: remote scripts still present:", leftover.join(" | ")); process.exit(1); }
console.log("no remote <script src> remain — fully offline. OK.");
