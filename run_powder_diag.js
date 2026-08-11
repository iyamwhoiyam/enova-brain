// POWDER GOLDEN DIAGNOSTIC — Power Life Peak MCT + Collagen Powder 30 serv (P26083 Rev 4).
// Proves the dosed-basis cost fix generalizes from capsules to powder, and isolates the ONE
// packaging nuance the kernel does not yet model: a container "qty/unit" multiplier.
// Golden (worksheet MASTER FORMULA):  blend/unit P69=$5.591119 · FG material COGS M93=$6.135597.
const B = require("./enova_brain.js");
const f = x => "$" + Number(x).toFixed(6);

// ── Actives: [alt, dosedMg (col I "mg Input Per Serving"), $/g (col K serv-cost ÷ dosed g)] ──
// Biotin's col I already bakes in its 20% overage + 98% potency, so we feed dosed directly, pot 100.
const ING = [
  ["ALT-RP-2198", 1000,               0.066369 ],  // CollaGem-V           $66.369/kg
  ["ALT-RP-1232", 2536,               0.024    ],  // MCT 70% powder       $24/kg
  ["ALT-RP-1695", 2000,               0.00857  ],  // Fibregrum B          $8.57/kg
  ["ALT-RP-2123", 0.3673469387755102, 0.225    ],  // Biotin 98% (20% ov)  $225/kg
  ["ALT-RP-0618", 250,                0.0199830],  // Sunflower Lecithin   $19.983/kg
  ["ALT-RP-2028", 300,                0.0288130],  // Nat Vanilla flavor   $28.813/kg
  ["ALT-RP-0738", 110,                0.0056880],  // Pink Himalayan Salt  $5.688/kg
  ["ALT-RP-1581", 100,                0.0385   ],  // Fat replacer flavor  $38.5/kg
  ["ALT-RP-2201", 150,                0.0351630],  // Vanilla Milkshake    $35.163/kg
  ["ALT-RP-1867", 22,                 0.295    ],  // Reb M 95%            $295/kg
  ["ALT-RP-0006", 22,                 0.0525   ],  // Stevia 97-99%        $52.5/kg
  ["ALT-RP-0925", 100,                0.042788 ],  // FlavorSweet          $42.788/kg
  ["ALT-RP-0355", 11,                 0.385    ],  // Luo Han Guo          $385/kg
  ["ALT-RP-2421", 464,                0.0051   ],  // Digestive Dextrin    $5.10/kg
];

// Packaging: [each price N, effective per-unit M, qty/unit O].  The worksheet cost is M = N × O.
const PKG = {
  container: { each: 0.38406,  eff: 0.204031875, qty: 0.53125 },   // ALT-BT-1204 19oz Cobalt PET
  closure:   { each: 0,        eff: 0,           qty: 1 },         // PWL-CA-0001 (customer supplied)
  label:     { each: 0.15,     eff: 0.15,        qty: 1 },         // PWL-LL house standard
  scoop:     { each: 0.07653,  eff: 0.07653,     qty: 1 },         // ALT-SC-0059
  desiccant: { each: 0.0295,   eff: 0.0295,      qty: 1 },         // ALT-DS-0014
  tamper:    { each: 0.020096, eff: 0.020096,    qty: 1 },         // ALT-TE-0065 neckband
  shipper:   { each: 1.736645, eff: 1.736645,    qty: 1/27 },      // ALT-BX-0216 (27/case)
};
const SLOTS = ["container", "closure", "label", "scoop", "desiccant", "tamper", "shipper"];

function invFor(mode) {
  const inv = {};
  ING.forEach(([a, , u]) => { inv[a] = { u }; });
  SLOTS.forEach(k => { inv["PK-" + k] = { u: PKG[k][mode === "eff" ? "eff" : "each"] }; });
  return inv;
}
function proj() {
  return {
    pn: "P26083-4", dosageForm: "Powder", isBulk: false,
    servingSize: 7.065367346938776, servingsPerUnit: 30, unitsPerContainer: 0,
    batchUnits: 5000, materialLoss: 0.02, overheadPct: 0.15,
    ingredients: ING.map(([a, dosed]) => ({ importedAlt: a, dosedMg: dosed, potencyPct: 100, item: { n: a } })),
    pkg: Object.fromEntries(SLOTS.map(k => [k, { n: "PK-" + k }])),
  };
}
function ctx(mode) {
  return {
    invIx: invFor(mode), container: "Canister",
    ctInfo: { bulk: false, pkg: SLOTS.map(k => ({ k })) },
    cfg: { gummy: false, shell: false, bulk: false, laborDefault: 0.5, moq: 5000 },
    unitNounForForm: "Unit", mbForm: "powder", masterBid: null, casePack: 27,
    constants: { label: 0.15, stickpack: 0.15, stickDisplay: 1.00 },
  };
}

console.log("── POWDER GOLDEN: Power Life Peak P26083 Rev 4 ──────────────────");
console.log("   golden blend/unit  P69 = $5.591119");
console.log("   golden FG material M93 = $6.135597\n");

for (const mode of ["eff", "each"]) {
  const r = B.cost(proj(), ctx(mode));
  const b = r.breakdown, v = r.view;
  const tag = mode === "eff" ? "worksheet effective per-unit (M = each × qty/unit)"
                             : "raw each-price (what the app imports today, no qty/unit)";
  console.log(`[${tag}]`);
  console.log("  servings/unit  ", v.mbServings, "(golden 30)");
  console.log("  blend/unit     ", f(b.activeCPU), " Δ", f(b.activeCPU - 5.591119));
  console.log("  packaging/unit ", f(b.pkgCPU));
  console.log("  materials COGS ", f(b.materialsCPU), " Δ", f(b.materialsCPU - 6.135597), "\n");
}
