// §33b UI wiring — render the REAL FormulationEditor (from the shipped app) for a Powder and a
// Liquid project and confirm: (1) the "Build Full Formula" button shows for these forms, (2) the
// Serving Weight (mg) field shows for powder/stickpack, (3) the embedded EnovaFormulator engine is
// reachable in-app and returns an exact balance. SSR (no click), so it proves the wiring RENDERS
// and the engine is present; the browser drive (shoot_forms.js) proves the click path.
const fs = require("fs");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };

const React = require(NG + "/react"), ReactDOMServer = require(NG + "/react-dom/server"), babel = require(NG + "/@babel/core");
// Master Bid engine (needed by FormulationEditor).
const a = html.indexOf("(function(root){"); const endTok = "})(typeof self!=='undefined'?self:this);";
const b = html.indexOf(endTok, a) + endTok.length; const mbRoot = {};
new Function("self", "module", html.slice(a, b) + "\n;return self.EnovaMasterBid;")(mbRoot, undefined);
const MB = mbRoot.EnovaMasterBid;
// Embedded formulator engine.
const efBlk = html.match(/<script id="enova-formulator">([\s\S]*?)<\/script>/);
const efRoot = {}; new Function("self", "module", efBlk[1] + "\n;self.__EF=self.EnovaFormulator;")(efRoot, undefined);
const EF = efRoot.__EF || efRoot.EnovaFormulator;
A(EF && typeof EF.build === "function", "embedded EnovaFormulator engine present in app");

let code = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code = code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/, "/*strip*/");
code += "\n;globalThis.__X__={FormulationEditor};";
const out = babel.transformSync(code, { presets: [[NG + "/@babel/preset-react", { runtime: "classic" }]], filename: "a.jsx", sourceType: "script" }).code;
const invData = (html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || "[]";

const noop = () => {}; const fakeEl = t => ({ textContent: t, addEventListener() {}, removeEventListener() {}, style: {}, appendChild() {}, setAttribute() {} });
const doc = { getElementById: id => id === "inv-data" ? fakeEl(invData) : fakeEl("{}"), createElement: () => fakeEl(""), body: fakeEl(""), addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
const win = { addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }), localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, alert: noop, confirm: () => true, location: { href: "", search: "" }, EnovaMasterBid: MB, EnovaFormulator: EF, EnovaBrain: require("./_kernel_for_tests") };
const sb = { React, ReactDOM: { createPortal: c => c, createRoot: () => ({ render: noop }) }, ReactDOMServer, document: doc, window: win, navigator: { userAgent: "node" }, localStorage: win.localStorage, XLSX: { utils: {}, read: () => ({}), write: () => "" }, mammoth: {}, Decimal: require(NG + "/decimal.js"), supabase: { createClient: () => ({ from: () => ({ select: () => ({}) }), channel: () => ({ on: () => ({ subscribe: noop }) }), auth: { getSession: async () => ({ data: {} }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }) } }) }, console, setTimeout, clearTimeout, setInterval, clearInterval, JSON, Math, Date, Object, Array, Number, String, Boolean, RegExp, Map, Set, Symbol, isNaN, parseFloat, parseInt, globalThis: {} };
sb.globalThis = sb; sb.self = sb; const vm = require("vm"); vm.createContext(sb); vm.runInContext(out, sb, { filename: "a.js" });
const { FormulationEditor } = sb.globalThis.__X__;

function renderForm(proj) {
  const s = ReactDOMServer.renderToString(React.createElement(FormulationEditor, { proj, projects: [proj], setProjects: noop, autoGenPn: null, onGenConsumed: noop }));
  return s.replace(/<!--\s*-->/g, "");
}

// Powder project with a couple of actives + a serving weight.
const powder = { pn: "P29990", customer: "TEST", product: "Test Greens", dosageForm: "Powder", isBulk: false,
  containerType: "Canister / Tub", servingSize: 1, servingsPerUnit: 30, batchUnits: 5000, overage: 0.05, servWtMg: 6000,
  shellItem: null, baseItems: {}, tierPricing: [], pkg: {}, ingredients: [{ id: 1, item: null, importedName: "Ashwagandha", inputMg: 600, potencyPct: 100 }] };
const pHtml = renderForm(powder);
A(/Build Full Formula/.test(pHtml), "powder: Build Full Formula button renders");
A(/Serving Weight \(mg\)/.test(pHtml), "powder: Serving Weight (mg) field renders");

// Liquid project — the Build button shows; liquid uses Serving Size (mL) as the target (no weight field).
const liquid = { pn: "P29991", customer: "TEST", product: "Test Shot", dosageForm: "Liquid", isBulk: false,
  containerType: "Tincture", servingSize: 60, servingsPerUnit: 30, batchUnits: 5000, overage: 0.05,
  shellItem: null, baseItems: {}, tierPricing: [], pkg: {}, ingredients: [{ id: 1, item: null, importedName: "Focus Blend", inputMg: 1500, potencyPct: 100 }] };
const lHtml = renderForm(liquid);
A(/Build Full Formula/.test(lHtml), "liquid: Build Full Formula button renders");

// Stickpack shows the Stick Weight field.
const stick = { pn: "P29992", customer: "TEST", product: "Test Stick", dosageForm: "Stickpacks", isBulk: false,
  containerType: "Stick-Pack Box", servingSize: 1, servingsPerUnit: 28, batchUnits: 5000, overage: 0.04, servWtMg: 4500,
  shellItem: null, baseItems: {}, tierPricing: [], pkg: {}, ingredients: [{ id: 1, item: null, importedName: "Theanine", inputMg: 400, potencyPct: 100 }] };
const stHtml = renderForm(stick);
A(/Stick Weight \(mg\)/.test(stHtml), "stickpack: Stick Weight (mg) field renders");
A(/Build Full Formula/.test(stHtml), "stickpack: Build Full Formula button renders");

// Capsule still shows the button (regression) and NO serving-weight field.
const cap = { pn: "P29993", customer: "TEST", product: "Test Cap", dosageForm: "Capsules", isBulk: false,
  containerType: "Bottle", servingSize: 1, servingsPerUnit: 30, batchUnits: 5000, overage: 0.03,
  shellItem: null, baseItems: {}, tierPricing: [], pkg: {}, ingredients: [{ id: 1, item: null, importedName: "X", inputMg: 500, potencyPct: 100 }] };
const cHtml = renderForm(cap);
A(/Build Full Formula/.test(cHtml), "capsule: Build Full Formula button still renders (regression)");
A(!/Serving Weight \(mg\)/.test(cHtml) && !/Stick Weight \(mg\)/.test(cHtml), "capsule: no serving-weight field (correct)");

// Engine reachable through the same window object the app uses.
const t = win.EnovaFormulator.build("Powder", { actives: [{ name: "A", alt: "ALT-A", mg: 3000 }], targetServingMg: 6000 });
A(Math.abs(t.rows.reduce((s, r) => s + r.mg, 0) - 6000) < 0.5, "in-app engine builds an exact 6000 mg powder");

console.log(fail === 0 ? "FORMULATOR UI WIRING CHECKS PASSED" : fail + " FAILED");
process.exit(fail ? 1 : 0);
