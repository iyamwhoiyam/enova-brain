// GOLDEN LOCK — RadiantGlow / Resveratrol Beauty Complex 60ct (RD07825-4), the team's approved
// worksheet. Proves the kernel costs the TOTAL dosed ingredient (worksheet col I "Input Per Serving")
// and reproduces the worksheet's material COGS. Calibrated 2026-08-10 from the customer's golden file.
const B = require((process.env.ENOVA_KERNEL || require("path").join(__dirname, "enova_brain.js")));
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-5 : t);

// Golden inventory: ingredient $/g (worksheet $/kg ÷ 1000), packaging $/each.
const INV = {
  "ALT-RP-0076": { u: 8.75/1000 }, "ALT-RP-0781": { u: 10/1000 }, "ALT-RP-1070": { u: 217/1000 },
  "ALT-RP-1604": { u: 180/1000 }, "ALT-RP-0461": { u: 68/1000 }, "ALT-RP-0611": { u: 85/1000 },
  "SHELL": { u: 0.0063 }, "BTL": { u: 0.21485 }, "CAP": { u: 0.0467 }, "LBL": { u: 0.15 },
  "DES": { u: 0.03 }, "TE": { u: 0.03 }, "SHIP": { u: 1.73 },
};
// [alt, dosed mg/serving = worksheet col I "Input Per Serving"]
const ING = [["ALT-RP-0076",47.5],["ALT-RP-0781",750],["ALT-RP-1070",300],["ALT-RP-1604",100],["ALT-RP-0461",10],["ALT-RP-0611",10]];
const proj = {
  pn: "RD07825-4", dosageForm: "Capsules", isBulk: false,
  servingSize: 2, servingsPerUnit: 30, unitsPerContainer: 60, batchUnits: 5000, overheadPct: 0.15,
  ingredients: ING.map(([a, mg]) => ({ importedAlt: a, dosedMg: mg, potencyPct: 100, item: { n: a } })),
  shellItem: { n: "SHELL" },
  pkg: { container:{n:"BTL"}, closure:{n:"CAP"}, label:{n:"LBL"}, desiccant:{n:"DES"}, tamper:{n:"TE"}, shipper:{n:"SHIP"} },
};
const ctx = {
  invIx: INV, container: "Bottle",
  ctInfo: { bulk:false, pkg:[{k:"container"},{k:"closure"},{k:"label"},{k:"desiccant"},{k:"tamper"},{k:"shipper"}] },
  cfg: { gummy:false, shell:true, bulk:false, laborDefault:0.5, moq:5000 },
  unitNounForForm: "Capsule", mbForm: "capsule", masterBid: null, casePack: 75,
  constants: { label:0.15, stickpack:0.15, stickDisplay:1.00 },
};
const b = B.cost(proj, ctx).breakdown;
A(near(b.activeCPU, 2.77637, 1e-5), "blend/actives = $2.77637 (golden), got " + b.activeCPU);
A(near(b.shellCPU, 0.378, 1e-9), "bulk-capsule shells = 60 × $0.0063 = $0.378, got " + b.shellCPU);
// material COGS ties the worksheet's $3.64841 within the master-case rounding the worksheet itself did
// (worksheet used qty/unit 0.013 for the 75-count case; kernel uses 1.73/75). Tolerance covers that.
A(near(b.materialsCPU, 3.64841, 0.001), "material COGS = $3.64841 (golden), got " + b.materialsCPU);

console.log(fail === 0 ? "RADIANTGLOW GOLDEN COST LOCK PASSED (material COGS ties the approved worksheet)" : fail + " FAILED");
process.exit(fail ? 1 : 0);
