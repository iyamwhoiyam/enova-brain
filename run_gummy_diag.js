// GUMMY GOLDEN DIAGNOSTIC — JAG Alliance Full Spectrum CBD Gummies 30ct (P25099 Rev 7), in production.
// Golden: blend/unit P71 = $0.4730892 · FG material COGS M94 = $0.5271455 (blend + master case only;
// CBD active + container/closure/label are all CUSTOMER-SUPPLIED at $0 → toll-manufacturing).
const B = require("./enova_brain.js");
const f = x => "$" + Number(x).toFixed(6);
// [name, alt, dosed mg/serv (col I), serv cost (col K)]  → $/g = K*1000/I  (0 when customer-supplied)
const ING = [
  ["FS CBD Distillate","JAG-RL-0014",32.8125,0], ["Shade Blue","ALT-RP-2085",12,0.0006],
  ["R/O Water","ALT-RL-0000",1150,0], ["Slow Set Pectin","ALT-RP-2013",185,0.00383875],
  ["Sugar","ALT-RP-0529",1575,0.002395575], ["Corn Syrup","ALT-RL-1381",1672,0.004407392],
  ["Citric Acid","ALT-RP-0003",40,0.00017152], ["Purple Plum","ALT-RP-1617",7,0.000333718],
  ["Mixed Berry Flavor","JAG-RL-0015",170,0], ["Corn Syrup 2","ALT-RL-1381",260,0.00068536],
  ["R/O Water 2","ALT-RL-0000",80,0], ["Sugar 2","ALT-RP-0529",450,0.00068445],
  ["MCT Oil","ALT-RL-1272",25,0.0003375], ["Sunflower Lecithin","ALT-RP-0618",6,0.000128676],
  ["MasterCoat","ALT-RL-2247",20,0.0006], ["MCT Oil 2","ALT-RL-1272",95,0.0012825],
  ["Sugar 3","ALT-RP-0529",200,0.0003042],
];
const INV = {}; ING.forEach(([n,a,mg,k],i)=>{ INV["G"+i] = { u: mg>0 ? k*1000/mg : 0 }; }); // $/g
INV["SHIP"] = { u: 1.732573 };
const CASEPACK = 1/0.0312;  // master case qty/unit 0.0312 → ~32/case

function proj(){ return {
  pn:"P25099-7", dosageForm:"Gummies - Retail", isBulk:false,
  servingSize:1, servingsPerUnit:30, unitsPerContainer:30, batchUnits:5000, materialLoss:0.02, overheadPct:0.15,
  ingredients: ING.map(([n,a,mg,k],i)=>({ importedAlt:a, dosedMg:mg, potencyPct:100, item:{n:"G"+i} })),
  pkg:{ shipper:{n:"SHIP"} },
}; }
// Cost the fully-specified recipe as a BLEND (base is inline) — gummy flag OFF so no derived base is added.
function ctx(gummyFlag){ return {
  invIx:INV, container:"Bottle", ctInfo:{bulk:false, pkg:[{k:"shipper"}]},
  cfg:{gummy:gummyFlag, shell:false, bulk:false, laborDefault:0.45, moq:5000},
  unitNounForForm:"Unit", mbForm:"gummy", masterBid:null, casePack:CASEPACK,
  constants:{label:0.15, stickpack:0.15, stickDisplay:1.00 },
}; }

console.log("── GUMMY GOLDEN: JAG P25099 Rev 7 (CBD 30ct) ────────────────────");
console.log("   golden blend/unit  P71 = $0.473089");
console.log("   golden FG material M94 = $0.527145 (blend + master case; CBD & retail pkg customer-supplied $0)\n");

const rF = B.cost(proj(), ctx(false)).breakdown;
console.log("[recipe costed as inline blend — CORRECT for a fully-specified production formula]");
console.log("  blend/unit    ", f(rF.activeCPU), " Δ", f(rF.activeCPU-0.4730892));
console.log("  packaging/unit", f(rF.pkgCPU), " (master case only)");
console.log("  materials COGS", f(rF.materialsCPU), " Δ", f(rF.materialsCPU-0.5271455));

const rT = B.cost(proj(), ctx(true)).breakdown;
console.log("\n[same rows with cfg.gummy=TRUE — kernel ADDS a derived base on top]");
console.log("  blend/unit    ", f(rT.activeCPU), "  base/unit", f(rT.baseCPU));
console.log("  materials COGS", f(rT.materialsCPU), " Δ", f(rT.materialsCPU-0.5271455), " ← double-counts the base if recipe already inline");
