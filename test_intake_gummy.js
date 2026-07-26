// Intake regression (§31) — the EXACT customer request Enova pasted (a sugar-free ACV gummy) must
// extract as a GUMMY, not silently default to Capsules. Guards the resolveFormCfgKey fix: the
// offline parser returns "Gummies - Retail" and the apply-path resolver keeps it a real FORM_CFG
// gummy key (so the turnkey base/coating/packaging + sugar-free variant fire).
const fs = require("fs");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const babel = require(NG + "/@babel/core");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };

// The verbatim request the user reported as extracting wrong.
const REQUEST = `Product Form: Gummy
Servings per unit: 30
Serving size: 2
Flavor: No artificial flavor-apple flavor
Color: no artificial color
Ingredients: ACV 1000mg
Sugar-free (0 g sugar)
Pectin-based (vegan preferred)
Non-stick coating to help prevent gummies from sticking together, especially during warmer weather
All-natural, clean-label formulation
No artificial colors or flavors
Great taste and texture
Client supplied materials: no
Packaging: Customer Choice, 250cc clear pet / white ribbed lid
Competitive bids: no
Competitive product price: no`;

// Evaluate the app module in a VM and expose the pure intake functions.
let code = html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code = code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/, "/*strip*/");
code += "\n;globalThis.__X__={localExtractF,resolveFormCfgKey,normalizeForm,FORM_CFG};";
const out = babel.transformSync(code, { presets: [[NG + "/@babel/preset-react", { runtime: "classic" }]], filename: "a.jsx", sourceType: "script" }).code;
const noop = () => {};
const sb = { React: require(NG + "/react"), ReactDOM: { createPortal: c => c, createRoot: () => ({ render: noop }) },
  ReactDOMServer: require(NG + "/react-dom/server"),
  document: { getElementById: () => ({ textContent: "[]" }), createElement: () => ({ style:{}, appendChild:noop, setAttribute:noop }), body:{}, addEventListener:noop, removeEventListener:noop, querySelector:()=>null, querySelectorAll:()=>[] },
  window: { addEventListener:noop, removeEventListener:noop, matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}), localStorage:{getItem:()=>null,setItem:noop,removeItem:noop} },
  navigator:{userAgent:"node"}, localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},
  XLSX:{utils:{},read:()=>({}),write:()=>""}, mammoth:{}, Decimal:require(NG+"/decimal.js"),
  console, setTimeout, clearTimeout, setInterval, clearInterval, JSON, Math, Date, Object, Array, Number, String, Boolean, RegExp, Map, Set, Symbol, isNaN, parseFloat, parseInt, Promise, globalThis:{} };
sb.globalThis = sb; sb.self = sb;
const vm = require("vm"); vm.createContext(sb); vm.runInContext(out, sb, { filename: "a.js" });
const { localExtractF, resolveFormCfgKey, FORM_CFG } = sb.globalThis.__X__;

const ext = localExtractF(REQUEST);
console.log("extracted form:", ext.dosageForm, "| gummyType:", ext.gummyType,
  "| ss:", ext.servingSize, "| spu:", ext.servingsPerUnit,
  "| ings:", ext.ingredients.map(i => `${i.name} ${i.mgPerServing}mg`).join(", "));

// 1) The parser must detect a GUMMY (was defaulting to Capsules downstream).
A(ext.dosageForm === "Gummies - Retail", "offline parser returns Gummies - Retail (got " + ext.dosageForm + ")");
A(ext.gummyType === "sugarFree", "sugar-free detected (got " + ext.gummyType + ")");

// 2) The apply-path resolver must keep it a REAL gummy FORM_CFG key (the bug: normalizeForm → 'Gummies' → not a key → Capsules).
const key = resolveFormCfgKey(ext.dosageForm);
A(key === "Gummies - Retail", "resolveFormCfgKey keeps a valid gummy key (got " + key + ")");
A(!!(FORM_CFG[key] && FORM_CFG[key].gummy), "resolved key is a gummy form → turnkey base/coating fires");
A(resolveFormCfgKey("Gummies") === "Gummies - Retail", "bare 'Gummies' also resolves to a real key");
A(resolveFormCfgKey("Gummies - Bulk") === "Gummies - Bulk", "bulk gummy preserved");
// Regression: the OLD path would have produced a non-key and fallen back to Capsules.
A(!FORM_CFG["Gummies"], "sanity: 'Gummies' is NOT a FORM_CFG key (why the bug existed)");

// 3) Serving math + the active dose parsed correctly.
A(ext.servingSize === 2, "serving size = 2 (got " + ext.servingSize + ")");
A(ext.servingsPerUnit === 30, "servings/unit = 30 (got " + ext.servingsPerUnit + ")");
const acv = ext.ingredients.find(i => /acv|apple cider/i.test(i.name));
A(acv && Math.abs(acv.mgPerServing - 1000) < 0.001, "ACV active parsed at 1000 mg/serving (got " + (acv && acv.mgPerServing) + ")");
A(acv && !/ingredient/i.test(acv.name), "ingredient name is clean (no 'Ingredients:' prefix), got '" + (acv && acv.name) + "'");
// The pectin/coating/sugar are the turnkey base — the parser must NOT list them as customer actives.
A(!ext.ingredients.some(i => /pectin|coating|sugar|water|citric/i.test(i.name)), "gummy base ingredients are NOT captured as actives (system adds them)");

console.log("\n" + (fail === 0 ? "INTAKE GUMMY CHECKS PASSED" : fail + " FAILED"));
process.exit(fail ? 1 : 0);
