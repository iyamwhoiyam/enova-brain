// CROSS-FORM CONFORMANCE — proves the methodology (blend → delivery system → packaging → labor →
// overhead → COGS) yields a complete, coherent build for EVERY product type, not just the two
// golden-locked forms. Uses the real kernel (enova_brain.js) + the real EnovaMasterBid engine.
const B = require("./enova_brain.js");
const fs = require("fs");
const html = fs.readFileSync("Enova_Brain_Studio_2.html", "utf8");
const a = html.indexOf("(function(root){"), endTok = "})(typeof self!=='undefined'?self:this);";
const b = html.indexOf(endTok, a) + endTok.length; const root = {};
new Function("self", "module", html.slice(a, b) + "\n;return self.EnovaMasterBid;")(root, undefined);
const MB = root.EnovaMasterBid;

let fail = 0; const A = (c, m) => { if (!c) { console.log("   ✗", m); fail++; } };
const fin = x => typeof x === "number" && isFinite(x);
const INV = { A1:{u:0.05}, A2:{u:0.20}, SHELL:{u:0.0063}, C:{u:0.22}, CL:{u:0.05}, LBL:{u:0.15},
  DES:{u:0.03}, TE:{u:0.02}, SC:{u:0.08}, SHIP:{u:1.73}, BAG:{u:0.09}, FOIL:{u:0.02}, DISP:{u:0.60} };
const K = { label:0.15, stickpack:0.15, stickDisplay:1.00 };

// [form, container, mbForm, cfg, pkgSlots, pkgSel, extra]
const FORMS = [
  ["Capsules","Bottle","capsule",{gummy:false,shell:true,bulk:false,laborDefault:0.35,moq:2500},
    ["container","closure","label","desiccant","tamper","shipper"],
    {container:"C",closure:"CL",label:"LBL",desiccant:"DES",tamper:"TE",shipper:"SHIP"},
    {servingSize:2,servingsPerUnit:30,unitsPerContainer:60,shellItem:{n:"SHELL"}}],
  ["Powder","Canister / Tub","powder",{gummy:false,shell:false,bulk:false,laborDefault:0.28,moq:1000},
    ["container","closure","label","scoop","tamper","shipper"],
    {container:"C",closure:"CL",label:"LBL",scoop:"SC",tamper:"TE",shipper:"SHIP"},
    {servingSize:5,servingsPerUnit:30,unitsPerContainer:0}],
  ["Liquid","Tincture","liquid",{gummy:false,shell:false,bulk:false,laborDefault:0.32,moq:1000},
    ["container","closure","label","tamper","shipper"],
    {container:"C",closure:"CL",label:"LBL",tamper:"TE",shipper:"SHIP"},
    {servingSize:1,servingsPerUnit:30,unitsPerContainer:0}],
  ["Powder Stick Pack","Stick-Pack Box","stickpack",{gummy:false,shell:false,bulk:false,laborDefault:0.38,moq:2500},
    ["foil","display","shipper"], {foil:"FOIL",display:"DISP",shipper:"SHIP"},
    {servingSize:1,servingsPerUnit:30,unitsPerContainer:30}],
  ["Gummies - Retail","Bottle","gummy",{gummy:true,shell:false,bulk:false,laborDefault:0.45,moq:2500},
    ["container","closure","label","tamper","shipper"],
    {container:"C",closure:"CL",label:"LBL",tamper:"TE",shipper:"SHIP"},
    {servingSize:2,servingsPerUnit:30,unitsPerContainer:60,gummyWt:3500}],
  ["Gummies - Bulk","Bulk Bag","gummy",{gummy:true,shell:false,bulk:true,laborDefault:0.025,moq:150000},
    ["bag","shipper"], {bag:"BAG",shipper:"SHIP"},
    {servingSize:2,servingsPerUnit:1,unitsPerContainer:1,gummyWt:3500}],
  ["Tablets","Bottle","tablet",{gummy:false,shell:false,bulk:false,laborDefault:0.30,moq:2500},
    ["container","closure","label","desiccant","shipper"],
    {container:"C",closure:"CL",label:"LBL",desiccant:"DES",shipper:"SHIP"},
    {servingSize:1,servingsPerUnit:30,unitsPerContainer:30}],
];

console.log("── CROSS-FORM CONFORMANCE (kernel + Master Bid) ─────────────────");
for (const [form, container, mbForm, cfg, slots, sel, extra] of FORMS) {
  console.log(`\n[${form} · ${container}]`);
  const proj = Object.assign({
    pn:"CF-"+mbForm, dosageForm:form, isBulk:!!cfg.bulk, batchUnits:cfg.moq, materialLoss:0.02, overheadPct:0.15,
    ingredients:[{importedAlt:"A1",dosedMg:500,potencyPct:100,item:{n:"A1"}},
                 {importedAlt:"A2",dosedMg:250,potencyPct:100,item:{n:"A2"}}],
    pkg:Object.fromEntries(Object.entries(sel).map(([k,v])=>[k,{n:v}])),
  }, extra);
  const ctx = { invIx:INV, container, ctInfo:{bulk:!!cfg.bulk,pkg:slots.map(k=>({k}))}, cfg,
    unitNounForForm:"Unit", mbForm, masterBid:MB, casePack:cfg.bulk?1:75, constants:K };
  const r = B.cost(proj, ctx), bd = r.breakdown, v = r.view;
  console.log(`   blend/unit $${bd.activeCPU.toFixed(4)}  pkg/unit $${bd.pkgCPU.toFixed(4)}  materials $${bd.materialsCPU.toFixed(4)}`);
  console.log(`   labor/unit $${bd.laborPerUnit.toFixed(4)}  oh/unit $${bd.overheadCPU.toFixed(4)}  COGS/unit $${bd.cogsPerUnit.toFixed(4)}  [${bd.source}]`);
  // Conformance invariants for every form:
  A(fin(bd.activeCPU) && bd.activeCPU > 0, "blend cost is finite and > 0");
  A(fin(bd.pkgCPU) && bd.pkgCPU >= 0, "packaging cost is finite and ≥ 0");
  A(fin(bd.materialsCPU) && bd.materialsCPU > 0, "materials COGS finite > 0");
  A(bd.source === "masterbid", "Master Bid drove labor/overhead");
  A(fin(bd.laborPerUnit) && bd.laborPerUnit > 0, "labor/unit finite > 0");
  A(fin(bd.overheadCPU) && bd.overheadCPU > 0, "overhead/unit finite > 0");
  A(fin(bd.cogsPerUnit) && bd.cogsPerUnit > bd.materialsCPU, "fully-loaded COGS > materials (labor+oh added)");
  A(!Object.values(bd).some(x => typeof x === "number" && !isFinite(x)), "no NaN/Infinity in breakdown");
  if (cfg.bulk) A(v.piecesPerContainer === 1, "bulk unit = 1 piece"); else A(v.piecesPerContainer >= 1, "finished unit has pieces");
}
console.log("\n" + (fail === 0 ? "ALL-FORMS CONFORMANCE PASSED — every product type yields a coherent build" : fail + " CHECK(S) FAILED"));
process.exit(fail ? 1 : 0);
