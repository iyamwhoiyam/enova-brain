// GOLDEN LOCK — Power Life Peak MCT + Collagen Powder 30 serv (P26083 Rev 4), the team's approved
// worksheet. Proves the kernel (a) costs the TOTAL dosed ingredient (col I) for a POWDER and
// reproduces the worksheet blend to the penny, and (b) honors a packaging "qty/unit" multiplier so
// the container ties to the sheet. Calibrated 2026-08-10 from the customer's golden file + live MIITEM.
const B = require((process.env.ENOVA_KERNEL || require("path").join(__dirname, "enova_brain.js")));
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-5 : t);

// Actives: [alt, dosed mg/serv (worksheet col I), $/g (MIITEM cAvg ÷ 1000)]. Biotin's dosed already
// bakes in its 20% overage + 98% potency, so potency is left at 100 and dosed is costed directly.
const ING = [
  ["ALT-RP-2198", 1000,               0.066369 ], ["ALT-RP-1232", 2536, 0.024   ],
  ["ALT-RP-1695", 2000,               0.00857  ], ["ALT-RP-2123", 0.3673469387755102, 0.225],
  ["ALT-RP-0618", 250,                0.0199830], ["ALT-RP-2028", 300,  0.0288130],
  ["ALT-RP-0738", 110,                0.0056880], ["ALT-RP-1581", 100,  0.0385  ],
  ["ALT-RP-2201", 150,                0.0351630], ["ALT-RP-1867", 22,   0.295   ],
  ["ALT-RP-0006", 22,                 0.0525   ], ["ALT-RP-0925", 100,  0.042788],
  ["ALT-RP-0355", 11,                 0.385    ], ["ALT-RP-2421", 464,  0.0051  ],
];
// Packaging: live MIITEM each-price, and the worksheet qty/unit (all 1 except the container 0.53125).
const INV = {}; ING.forEach(([a, , u]) => { INV[a] = { u }; });
Object.assign(INV, {
  "PK-container": { u: 0.38406 }, "PK-closure": { u: 0 }, "PK-label": { u: 0.15 },
  "PK-scoop": { u: 0.07653 }, "PK-desiccant": { u: 0.0295 }, "PK-tamper": { u: 0.020096 },
  "PK-shipper": { u: 1.736645 },
});
const QTY = { container: 0.53125, closure: 1, label: 1, scoop: 1, desiccant: 1, tamper: 1 };
const SLOTS = ["container", "closure", "label", "scoop", "desiccant", "tamper", "shipper"];
const proj = {
  pn: "P26083-4", dosageForm: "Powder", isBulk: false,
  servingSize: 7.065367346938776, servingsPerUnit: 30, unitsPerContainer: 0,
  batchUnits: 5000, materialLoss: 0.02, overheadPct: 0.15,
  ingredients: ING.map(([a, mg]) => ({ importedAlt: a, dosedMg: mg, potencyPct: 100, item: { n: a } })),
  pkg: Object.fromEntries(SLOTS.map(k => [k, Object.assign({ n: "PK-" + k }, QTY[k] != null ? { qty: QTY[k] } : {})])),
};
const ctx = {
  invIx: INV, container: "Canister", ctInfo: { bulk: false, pkg: SLOTS.map(k => ({ k })) },
  cfg: { gummy: false, shell: false, bulk: false, laborDefault: 0.5, moq: 5000 },
  unitNounForForm: "Unit", mbForm: "powder", masterBid: null, casePack: 27,
  constants: { label: 0.15, stickpack: 0.15, stickDisplay: 1.00 },
};
const r = B.cost(proj, ctx), b = r.breakdown, v = r.view;
A(v.mbServings === 30, "servings/costing unit = 30, got " + v.mbServings);
A(near(b.activeCPU, 5.591119, 1e-5), "powder blend/unit = $5.591119 (golden P69), got " + b.activeCPU);
A(b.shellCPU === 0, "powder has no shell, got " + b.shellCPU);
// FG material COGS: blend 5.591119 + container 0.204032 + label 0.15 + scoop 0.07653 + desiccant
// 0.0295 + neckband 0.020096 + case 1.736645/27 = 6.135597 (worksheet M93, to the penny).
A(near(b.materialsCPU, 6.135597, 1e-4), "powder FG material COGS = $6.135597 (golden M93), got " + b.materialsCPU);

// Guard: a container qty/unit of 1 (no multiplier) reproduces the raw catalog basis (+$0.180028) —
// proving the fix is the qty multiplier, and that it defaults OFF (qty 1) for existing projects.
const p2 = JSON.parse(JSON.stringify(proj)); p2.pkg.container = { n: "PK-container" };
const b2 = B.cost(p2, ctx).breakdown;
A(near(b2.materialsCPU, 6.135597 + 0.180028, 1e-4), "qty=1 falls back to catalog each-price basis, got " + b2.materialsCPU);

console.log(fail === 0 ? "POWER LIFE PEAK POWDER GOLDEN LOCK PASSED (dosed blend + container qty/unit tie the worksheet)" : fail + " FAILED");
process.exit(fail ? 1 : 0);
