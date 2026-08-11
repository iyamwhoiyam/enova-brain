// GOLDEN LOCK — JAG Alliance Full Spectrum CBD Gummies 30ct (P25099 Rev 7), IN PRODUCTION.
// Proves the kernel costs a GUMMY the way an approved production formula is built: the full recipe
// (base matrix + actives) is costed inline as the blend on the dosed basis, plus packaging. Ties the
// worksheet blend P71 = $0.4730892 and FG material COGS M94 = $0.5271455 to the penny.
// JAG is toll-manufacturing: CBD distillate + retail container/closure/label are CUSTOMER-SUPPLIED
// at $0, so material COGS = blend + master case only. Calibrated 2026-08-10 from the production file.
const B = require((process.env.ENOVA_KERNEL || require("path").join(__dirname, "enova_brain.js")));
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-5 : t);

// [alt, dosed mg/serv (col I), serv cost (col K)]. $/g = K*1000/mg; 0 = customer-supplied (CBD, water, flavors).
const ING = [
  ["JAG-RL-0014",32.8125,0], ["ALT-RP-2085",12,0.0006], ["ALT-RL-0000",1150,0],
  ["ALT-RP-2013",185,0.00383875], ["ALT-RP-0529",1575,0.002395575], ["ALT-RL-1381",1672,0.004407392],
  ["ALT-RP-0003",40,0.00017152], ["ALT-RP-1617",7,0.000333718], ["JAG-RL-0015",170,0],
  ["ALT-RL-1381b",260,0.00068536], ["ALT-RL-0000b",80,0], ["ALT-RP-0529b",450,0.00068445],
  ["ALT-RL-1272",25,0.0003375], ["ALT-RP-0618",6,0.000128676], ["ALT-RL-2247",20,0.0006],
  ["ALT-RL-1272b",95,0.0012825], ["ALT-RP-0529c",200,0.0003042],
];
const INV = {}; ING.forEach(([a, mg, k], i) => { INV["G" + i] = { u: mg > 0 ? k * 1000 / mg : 0 }; });
INV["SHIP"] = { u: 1.732573 };
const proj = {
  pn: "P25099-7", dosageForm: "Gummies - Retail", isBulk: false,
  servingSize: 1, servingsPerUnit: 30, unitsPerContainer: 30, batchUnits: 5000, materialLoss: 0.02, overheadPct: 0.15,
  ingredients: ING.map(([a, mg], i) => ({ importedAlt: a, dosedMg: mg, potencyPct: 100, item: { n: "G" + i } })),
  pkg: { shipper: { n: "SHIP" } },
};
// Fully-specified recipe → cost inline as the blend (gummy flag OFF so no derived base is double-added).
const ctx = {
  invIx: INV, container: "Bottle", ctInfo: { bulk: false, pkg: [{ k: "shipper" }] },
  cfg: { gummy: false, shell: false, bulk: false, laborDefault: 0.45, moq: 5000 },
  unitNounForForm: "Unit", mbForm: "gummy", masterBid: null, casePack: 1 / 0.0312,
  constants: { label: 0.15, stickpack: 0.15, stickDisplay: 1.00 },
};
const b = B.cost(proj, ctx).breakdown;
A(near(b.activeCPU, 0.4730892, 1e-6), "gummy blend/unit = $0.4730892 (golden P71), got " + b.activeCPU);
A(near(b.pkgCPU, 0.0540563, 1e-6), "master case only (customer-supplied retail pkg) = $0.0540563, got " + b.pkgCPU);
A(near(b.materialsCPU, 0.5271455, 1e-5), "gummy FG material COGS = $0.5271455 (golden M94), got " + b.materialsCPU);

// ── Toll-manufacturing flags: the worksheet's ACTUAL packaging block, modeled explicitly. ─────────
// JAG-BT-0002 / JAG-CA-0002 / "Unlabeled" are all CUSTOMER-SUPPLIED → each $0, and the $0.15 house
// label pin is SUPPRESSED. Materials must still tie golden M94 exactly.
INV["JBT"] = { u: 0.31 }; INV["JCA"] = { u: 0.06 }; INV["JLBL"] = { u: 0.02 };   // real catalog $ — must NOT leak in
const p2 = JSON.parse(JSON.stringify(proj));
p2.pkg = {
  container: { n: "JBT", customerSupplied: true },
  closure:   { n: "JCA", customerSupplied: true },
  label:     { n: "JLBL", customerSupplied: true },
  shipper:   { n: "SHIP" },
};
const ctx2 = Object.assign({}, ctx, { ctInfo: { bulk: false, pkg: [{k:"container"},{k:"closure"},{k:"label"},{k:"shipper"}] } });
const b2 = B.cost(p2, ctx2).breakdown;
A(near(b2.pkgCPU, 0.0540563, 1e-6), "customer-supplied container+closure+label cost $0 (label pin suppressed), got pkg " + b2.pkgCPU);
A(near(b2.materialsCPU, 0.5271455, 1e-5), "toll-mfg materials COGS still ties golden M94, got " + b2.materialsCPU);

// Guard 1: WITHOUT the flags the label pin + catalog prices would (correctly) load the unit.
const p3 = JSON.parse(JSON.stringify(p2));
Object.values(p3.pkg).forEach(s => delete s.customerSupplied);
const b3 = B.cost(p3, ctx2).breakdown;
A(near(b3.pkgCPU, 0.0540563 + 0.31 + 0.06 + 0.15, 1e-6), "flags off → catalog container+closure + $0.15 label pin apply, got " + b3.pkgCPU);

// Guard 2: a reviewer's explicit label cost edit (costOverride) also beats the $0.15 pin.
const p4 = JSON.parse(JSON.stringify(p3));
p4.costOverride = { "JLBL": 0.02 };
const b4 = B.cost(p4, ctx2).breakdown;
A(near(b4.pkgCPU, 0.0540563 + 0.31 + 0.06 + 0.02, 1e-6), "label costOverride beats the house pin, got " + b4.pkgCPU);

console.log(fail === 0 ? "JAG CBD GUMMY GOLDEN LOCK PASSED (inline-recipe blend + toll-mfg customer-supplied packaging tie the production worksheet)" : fail + " FAILED");
process.exit(fail ? 1 : 0);
