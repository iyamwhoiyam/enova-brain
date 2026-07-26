// §32 — parse Enova's REAL completed Master Formula workbooks (the 3 reference files) through the
// app's parseMasterFormulaWorkbook and assert each form's full formula + packaging import correctly,
// matched to inventory by RM#. This is the "capture the 100+ completed formulas" path; it must never
// invent and must preserve every dosed/coded line.
const fs = require("fs");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const babel = require(NG + "/@babel/core");
const XLSX = require(NG + "/xlsx");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };

const REFS = (process.env.ENOVA_REFS||require("path").join(__dirname,"refs"));
if (!fs.existsSync(REFS + "/P26199_RelaxEnergyPowder.xlsx")) { console.log("SKIP: reference workbooks not present"); process.exit(0); }

let code = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code = code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/, "/*strip*/");
code += "\n;globalThis.__X__={parseMasterFormulaWorkbook,INV_IX};";
const out = babel.transformSync(code, { presets: [[NG + "/@babel/preset-react", { runtime: "classic" }]], filename: "a.jsx", sourceType: "script" }).code;

const invData = (html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || "[]";
const noop = () => {};
const win = { XLSX, addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }), localStorage: { getItem: () => null, setItem: noop, removeItem: noop } };
const doc = { getElementById: (id) => ({ textContent: id === 'inv-data' ? invData : (id === 'wip-seed' ? '[]' : '{}') }), createElement: () => ({ style: {}, appendChild: noop, setAttribute: noop }), body: {}, addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [] };
const sb = { React: require(NG + "/react"), ReactDOM: { createPortal: c => c, createRoot: () => ({ render: noop }) }, ReactDOMServer: require(NG + "/react-dom/server"), document: doc, window: win, navigator: { userAgent: "node" }, localStorage: win.localStorage, XLSX, mammoth: {}, Decimal: require(NG + "/decimal.js"), console, setTimeout, clearTimeout, setInterval, clearInterval, JSON, Math, Date, Object, Array, Number, String, Boolean, RegExp, Map, Set, Symbol, isNaN, parseFloat, parseInt, Promise, globalThis: {} };
sb.globalThis = sb; sb.self = sb; const vm = require("vm"); vm.createContext(sb); vm.runInContext(out, sb, { filename: "a.js" });
const { parseMasterFormulaWorkbook, INV_IX } = sb.globalThis.__X__;

const CASES = [
  { f: "P26199_RelaxEnergyPowder.xlsx", form: "Powder", spu: 45, minIngs: 13, ss: 1,
    have: [/tyrosine/i, /ashwagandha/i, /chamomile/i, /citric acid/i], pkg: ["container", "closure", "scoop", "desiccant"] },
  { f: "P262111_BCAAPowder.xlsx", form: "Powder", spu: 30, minIngs: 10, ss: 1,
    have: [/leucine/i, /isoleucine/i, /valine/i, /taurine/i, /citrulline/i], pkg: [] },
  { f: "P26175_ElderberrySyrup.xlsx", form: "Liquid", spu: 1, minIngs: 6, ss: 1,
    have: [/elderberry/i, /honey/i, /ginger/i, /water/i], pkg: ["closure", "shipper"] },
];

for (const c of CASES) {
  const wb = XLSX.readFile(REFS + "/" + c.f);
  const ext = parseMasterFormulaWorkbook(wb);
  A(ext != null, `parsed ${c.f}`);
  if (!ext) continue;
  const alts = ext.ingredients.filter(i => i.alt);
  const matched = alts.filter(i => INV_IX[i.alt]);
  console.log(`\n${c.f} → form=${ext.dosageForm} ss=${ext.servingSize} spu=${ext.servingsPerUnit} ings=${ext.ingredients.length} (RM# ${alts.length}, in-inv ${matched.length}) pkg=[${ext.packaging ? Object.keys(ext.packaging).join(",") : ""}]`);
  A(ext.dosageForm === c.form, `${c.f}: form ${c.form} (got ${ext.dosageForm})`);
  A(ext.servingsPerUnit === c.spu, `${c.f}: servings/unit ${c.spu} (got ${ext.servingsPerUnit})`);
  A(ext.servingSize === c.ss, `${c.f}: serving size ${c.ss} (got ${ext.servingSize})`);
  A(ext.ingredients.length >= c.minIngs, `${c.f}: >=${c.minIngs} lines (got ${ext.ingredients.length})`);
  for (const re of c.have) A(ext.ingredients.some(i => re.test(i.name)), `${c.f}: captured ${re}`);
  A(alts.length >= 5, `${c.f}: carries RM#/ALT codes (${alts.length})`);
  A(matched.length >= 1, `${c.f}: some RM# resolve to live inventory (${matched.length})`);
  // never invents prices; potency in range
  A(ext.ingredients.every(i => i.potencyPct >= 1 && i.potencyPct <= 100), `${c.f}: potency in 1..100`);
  A(Array.isArray(ext.tierPricing) && ext.tierPricing.length === 0, `${c.f}: no prices parsed (tier pricing manual)`);
  for (const slot of c.pkg) A(ext.packaging && ext.packaging[slot] && /^ALT-/.test(ext.packaging[slot].n), `${c.f}: packaging '${slot}' has a real SKU (${ext.packaging && ext.packaging[slot] && ext.packaging[slot].n})`);
}

// Spot-check the actives-heavy powder captured its flavor + acid system, and the syrup its solvent base.
const relax = parseMasterFormulaWorkbook(XLSX.readFile(REFS + "/P26199_RelaxEnergyPowder.xlsx"));
A(relax.ingredients.some(i => /citric acid/i.test(i.name)), "powder acid system captured (citric acid)");
A(relax.ingredients.some(i => /tea|flavor|lime/i.test(i.name)), "powder flavor system captured");
const syrup = parseMasterFormulaWorkbook(XLSX.readFile(REFS + "/P26175_ElderberrySyrup.xlsx"));
A(syrup.ingredients.some(i => /water/i.test(i.name)), "syrup solvent base captured (R/O water)");
A(syrup.ingredients.some(i => /honey/i.test(i.name)), "syrup sweetener base captured (honey)");

console.log("\n" + (fail === 0 ? "MASTER FORMULA IMPORT CHECKS PASSED" : fail + " FAILED"));
process.exit(fail ? 1 : 0);
