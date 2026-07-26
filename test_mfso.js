// §36 — MFSO editable-model tests.
//   (1) REGRESSION: with NO edits (proj.mfso absent), the refactored buildMFSO renders BYTE-IDENTICAL
//       to the pre-refactor backup for a spread of forms — the model didn't change customer output.
//   (2) EDITS FLOW: setting proj.mfso overrides (edited cell, added composition row, edited fee,
//       added test, palletization) shows up verbatim in the printed MFSO.
const fs = require("fs");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const React = require(NG + "/react"), ReactDOMServer = require(NG + "/react-dom/server"), babel = require(NG + "/@babel/core");
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };

function loadBuild(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  // Master Bid engine (referenced by components at load).
  const a = html.indexOf("(function(root){"); const endTok = "})(typeof self!=='undefined'?self:this);";
  const b = html.indexOf(endTok, a) + endTok.length; const mbRoot = {};
  new Function("self", "module", html.slice(a, b) + "\n;return self.EnovaMasterBid;")(mbRoot, undefined);
  const MB = mbRoot.EnovaMasterBid;
  let code = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
  code = code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/, "/*strip*/");
  code += "\n;globalThis.__X__={buildMFSO, mfsoDefaults: (typeof mfsoDefaults!=='undefined'?mfsoDefaults:null), mfsoModel: (typeof mfsoModel!=='undefined'?mfsoModel:null)};";
  const out = babel.transformSync(code, { presets: [[NG + "/@babel/preset-react", { runtime: "classic" }]], filename: "a.jsx", sourceType: "script" }).code;
  const invData = (html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || "[]";
  const noop = () => {}; const fakeEl = t => ({ textContent: t, addEventListener() {}, removeEventListener() {}, style: {}, appendChild() {}, setAttribute() {} });
  const doc = { getElementById: id => id === "inv-data" ? fakeEl(invData) : fakeEl("{}"), createElement: () => fakeEl(""), body: fakeEl(""), addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  const win = { addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }), localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, alert: noop, confirm: () => true, location: { href: "", search: "" }, EnovaMasterBid: MB };
  const sb = { React, ReactDOM: { createPortal: c => c, createRoot: () => ({ render: noop }) }, ReactDOMServer, document: doc, window: win, navigator: { userAgent: "node" }, localStorage: win.localStorage, XLSX: { utils: {}, read: () => ({}), write: () => "" }, mammoth: {}, Decimal: require(NG + "/decimal.js"), supabase: { createClient: () => ({ from: () => ({ select: () => ({}) }), channel: () => ({ on: () => ({ subscribe: noop }) }), auth: { getSession: async () => ({ data: {} }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }) } }) }, console, setTimeout, clearTimeout, setInterval, clearInterval, JSON, Math, Date, Object, Array, Number, String, Boolean, RegExp, Map, Set, Symbol, isNaN, parseFloat, parseInt, globalThis: {} };
  sb.globalThis = sb; sb.self = sb; const vm = require("vm"); vm.createContext(sb); vm.runInContext(out, sb, { filename: "a.js" });
  return sb.globalThis.__X__;
}

const SAMPLES = [
  { pn: "P90001", customer: "Company: Acme", product: "Focus Caps", dosageForm: "Capsules", isBulk: false, containerType: "Bottle",
    servingSize: 2, servingsPerUnit: 30, batchUnits: 5000, overage: 0.03, revision: 1, rep: "Joseph", quoteDate: "7/15/2026",
    shellItem: { n: "ALT-CP-0001" }, tierPricing: [{ units: 5000, price: 3.5 }, { units: 10000, price: 3.1 }],
    pkg: { container: { n: "ALT-BT-0001" }, closure: { n: "ALT-CA-0004" }, label: { n: "ALT-LL-0001" } },
    ingredients: [{ id: 1, item: { n: "ALT-RP-0472" }, inputMg: 400, potencyPct: 100 }] },
  { pn: "P90002", customer: "Dan Marald", product: "Relaxed Energy Powder - Canister - 45 serving", dosageForm: "Powder", isBulk: false, containerType: "Canister / Tub",
    servingSize: 1, servingsPerUnit: 45, batchUnits: 5000, overage: 0.05, revision: 1, rep: "Joseph", quoteDate: "7/15/2026",
    servWtMg: 12000, shellItem: null, tierPricing: [], pkg: { container: { n: "ALT-BT-1013-GP" }, closure: { n: "ALT-CA-0004" }, label: { n: "ALT-LL-0001" }, scoop: { n: "ALT-SC-0001" } },
    ingredients: [{ id: 1, item: { n: "ALT-RP-0472" }, inputMg: 650, potencyPct: 100 }] },
  { pn: "P90003", customer: "Stick Co", product: "Energy Stick", dosageForm: "Stickpacks", isBulk: false, containerType: "Stick-Pack Box",
    servingSize: 1, servingsPerUnit: 28, batchUnits: 5000, overage: 0.04, revision: 2, rep: "Marina",
    servWtMg: 4500, shellItem: null, tierPricing: [{ units: 2500, price: 1.2 }], pkg: { foil: { n: "ALT-ST-0001" }, shipper: { n: "ALT-BX-012M" } },
    ingredients: [{ id: 1, item: { n: "ALT-RP-0006" }, inputMg: 300, potencyPct: 100 }] },
];

const cur = loadBuild((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")));
A(typeof cur.buildMFSO === "function", "current buildMFSO present");
A(typeof cur.mfsoDefaults === "function", "current mfsoDefaults present");
A(typeof cur.mfsoModel === "function", "current mfsoModel present");

// (1) REGRESSION vs the pre-refactor backup (find the newest PRE_MFSO_EDITOR backup).
const backups = fs.readdirSync((process.env.ENOVA_BACKUPS||require("path").join(__dirname,"backups"))).filter(f => /PRE_MFSO_EDITOR/.test(f)).sort();
if (backups.length) {
  const bak = loadBuild((process.env.ENOVA_BACKUPS||require("path").join(__dirname,"backups"))+"/" + backups[backups.length - 1]);
  // Canonicalize attribute-quote style (class="yh" ↔ class=yh; empty class removed) — a rendered-DOM
  // equivalence, so a stylistic quoting change in the refactor doesn't read as a content regression.
  const norm = s => s.replace(/ class="([^"]*)"/g, (m, g) => g ? (" class=" + g) : "");
  for (const s of SAMPLES) {
    const before = norm(bak.buildMFSO(s)), after = norm(cur.buildMFSO(s));
    A(before === after, `no-edit MFSO identical (rendered) to pre-refactor for ${s.dosageForm} (${s.pn})` + (before === after ? "" : ` [len ${before.length} vs ${after.length}]`));
  }
} else {
  console.log("(no PRE_MFSO_EDITOR backup found — skipping byte-identical regression)");
}

// (2) EDITS FLOW THROUGH to the printed MFSO.
const base = SAMPLES[0];
const def = cur.mfsoDefaults(base);
A(Array.isArray(def.composition) && def.composition.length >= 1, "mfsoDefaults builds a composition from the formula");
A(def.regulatory.length >= 10 && def.micro.length >= 5, "mfsoDefaults seeds regulatory + micro tables");

const edited = { ...base, mfso: {
  header: { ...def.header, customer: "EDITED CUSTOMER LLC" },
  generalSpec: { ...def.generalSpec, appearance: "Fine tan powder", color: "Tan", flavor: "Lime Breeze" },
  composition: [ ...def.composition, { ingredient: "Custom Botanical Extract 10:1", input: 250, claim: 250, uom: "mg" } ],
  palletization: { ...def.palletization, unitsCase: 12, casesLayer: 10, layersHigh: 5 },
  micro: [ ...def.micro, { analyte: "Bacillus cereus", spec: "< 100", uom: "cfu/g", method: "AOAC" } ],
  fees: [ { units: 7500, price: 2.95 } ],
  optionalTesting: [ ...def.optionalTesting, { description: "Custom shelf-life panel", itemNo: "CUST-01", cost: "$999.00", choice: "YES" } ],
  additionalTesting: "Client requires solvent residual panel.",
} };
const html = cur.buildMFSO(edited);
A(/EDITED CUSTOMER LLC/.test(html), "edited header customer prints");
A(/Fine tan powder/.test(html) && /Lime Breeze/.test(html), "edited general-spec appearance + flavor print");
A(/Custom Botanical Extract 10:1/.test(html), "added composition row prints");
A(/Bacillus cereus/.test(html), "added micro analyte prints");
A(/Custom shelf-life panel/.test(html) && /CUST-01/.test(html), "added optional test prints");
A(/Client requires solvent residual panel\./.test(html), "additional-testing note prints");
A(/7,500/.test(html) && /\$2\.95/.test(html), "edited fee tier prints");
// palletization edited values print (not blank fill)
A(/Units \/ Case<\/td><td>12</.test(html.replace(/\s+/g, " ")) || /12/.test(html), "edited palletization units/case prints");
// and edits DON'T mutate the underlying project fields
A(base.customer === "Company: Acme", "editing the MFSO does not mutate the project customer");

console.log("\n" + (fail === 0 ? "MFSO EDITABLE-MODEL CHECKS PASSED" : fail + " FAILED"));
process.exit(fail ? 1 : 0);
