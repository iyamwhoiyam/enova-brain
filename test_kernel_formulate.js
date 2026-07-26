// ─────────────────────────────────────────────────────────────────────────────
// EnovaBrain.formulate() — the unified backend entry for a form's complete turnkey base/system.
// Gummies are built natively by the kernel (displacement base KB); capsule/powder/stickpack/liquid
// route to the injected EnovaFormulator (flow & anti-caking agents, bulking carrier, sweetener/
// flavor/acid, preservatives, excipients). One call, any form. This locks that routing + shape.
// ─────────────────────────────────────────────────────────────────────────────
const B = require((process.env.ENOVA_KERNEL||require("path").join(__dirname,"enova_brain.js")));
let EF; try { EF = require((process.env.ENOVA_FORMULATOR||require("path").join(__dirname,"enova_formulator.js"))); } catch (e) { EF = null; }
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };

const INV = { "ALT-RP-0529": { u: 0.0011 }, "ALT-RL-1381": { u: 0.0013 }, "ALT-RP-2013": { u: 0.025 },
  "ALT-RP-0003": { u: 0.004 }, "ALT-RP-1859": { u: 0.006 }, "ALT-RL-0111": { u: 0.03 }, "ALT-RP-2026": { u: 0.04 },
  "ALT-RL-1272": { u: 0.009 }, "ALT-RP-0618-GP-VS": { u: 0.07 }, "ALT-RL-2247": { u: 0.12 } };

// ── gummy → kernel-native base ────────────────────────────────────────────────
(() => {
  const proj = { dosageForm: "Gummies", gummyType: "sugar", gummyWt: 4500, servingSize: 2,
    ingredients: [{ inputMg: 1000, potencyPct: 100, item: { n: "X" } }] };
  const r = B.formulate(proj, { invIx: INV, bulk: false });
  A(r.engine === "kernel", "gummy routes to the kernel-native base engine");
  A(r.rows.length === 13, "sugar retail gummy base = 13 rows");
  A(r.costPerPiece > 0, "gummy base has a positive per-piece cost");
  A(Math.abs(r.base.totalMg - 4500) < 1e-6, "gummy actives + base = gummyWt exactly");
  // bulk drops the coating rows
  const rb = B.formulate(proj, { invIx: INV, bulk: true });
  A(rb.rows.length < r.rows.length, "bulk gummy drops the coating rows");
})();

// ── powder/stickpack/liquid/capsule → delegated to EnovaFormulator ─────────────
(() => {
  if (!EF) { console.log("NOTE: enova_formulator.js not present — skipping delegated-form checks"); return; }
  const powder = B.formulate({ dosageForm: "Powder" },
    { formulator: EF, formulatorForm: "Powder", formulatorInput: { actives: [{ name: "Creatine", alt: "ALT-A", mg: 5000 }], targetServingMg: 13000 } });
  A(powder.engine === "EnovaFormulator", "powder routes to EnovaFormulator");
  A(Array.isArray(powder.rows) && powder.rows.length > 0, "powder returns system rows");
  // the delegated engine must actually add the house system (not just echo the active)
  A(powder.rows.length >= 3, "powder system has multiple components (flow/bulking/etc.)");

  const cap = B.formulate({ dosageForm: "Capsules" },
    { formulator: EF, formulatorForm: "Capsules", formulatorInput: { actives: [{ name: "Vit C", alt: "ALT-A", mg: 500 }], capsulesPerServing: 2 } });
  A(cap.engine === "EnovaFormulator", "capsules route to EnovaFormulator");
})();

// ── honest degradation: no engine wired ───────────────────────────────────────
(() => {
  const r = B.formulate({ dosageForm: "Powder" }, {});
  A(r.engine === null, "no formulator wired → engine null (no crash, no invention)");
  A(r.notes && r.notes.length > 0, "a note explains the missing engine");
})();

console.log(fail === 0 ? "ENOVA BRAIN FORMULATE CHECKS PASSED" : fail + " FAILED");
process.exit(fail ? 1 : 0);
