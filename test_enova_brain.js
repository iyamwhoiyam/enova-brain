// ─────────────────────────────────────────────────────────────────────────────
// Enova Brain kernel — golden reconciliation suite.
// The kernel is the hardening layer: it RE-DERIVES every money/mass figure from
// the formula + live inventory and cross-checks the app's stored outputs. This
// suite proves two things:
//   1. A clean, internally-consistent project passes EVERY invariant (0 errors, 0 warnings).
//   2. Each injected fault trips EXACTLY the invariant code that should catch it.
// Run: node test_enova_brain.js   (registered in run_all_tests.sh)
// ─────────────────────────────────────────────────────────────────────────────
const B = require((process.env.ENOVA_KERNEL||require("path").join(__dirname,"enova_brain.js")));
let fail = 0;
const A = (cond, msg) => { if (!cond) { console.log("FAIL:", msg); fail++; } };

// ── the inventory index the kernel re-derives against (key → { u: $/gram }) ──
const INV = {
  "ACT-A": { u: 0.02 },   // $0.02 / g
  "ACT-B": { u: 0.10 },   // $0.10 / g
  "SHELL": { u: 0.01 },   // shell $/cap (piece)
};

// ── a clean capsule project, made internally consistent BY CONSTRUCTION ──────
function cleanProject() {
  const p = {
    pn: "P26205",
    dosageForm: "Capsules",
    overage: 0.03,
    servingSize: 2,          // caps / serving
    servingsPerUnit: 30,
    unitsPerContainer: 60,   // 60 caps / bottle
    ingredients: [
      { importedAlt: "ACT-A", inputMg: 500, potencyPct: 100, item: { n: "ACT-A" } },
      { importedAlt: "ACT-B", inputMg: 250, potencyPct: 50,  item: { n: "ACT-B" } }, // 50% potency
    ],
    tierPricing: [
      { units: 1000,  price: 7.50 },
      { units: 5000,  price: 6.75 },
      { units: 10000, price: 6.00 },
    ],
    mfso: { composition: [{ input: 500 }, { input: 250 }] },
    cogsBreakdown: {
      isBulk: false, piecesPerContainer: 60,
      baseCPU: 0, shellCPU: 0.60, pkgCPU: 0.75,
      dmExtraCPU: 0.10, laborPerUnit: 0.85, overheadCPU: 0.45,
      // activeCPU / materialsCPU / cogsPerUnit backfilled below so the fixture ties out exactly.
    },
  };
  const der = B.deriveActiveCPU(p, INV);
  const cb = p.cogsBreakdown;
  cb.activeCPU = der.activeCPU;
  cb.materialsCPU = cb.activeCPU + cb.baseCPU + cb.shellCPU + cb.pkgCPU;
  cb.cogsPerUnit = cb.materialsCPU + cb.dmExtraCPU + cb.laborPerUnit + cb.overheadCPU;
  // a matching approval lock so LOCK_NO_DRIFT exercises its passing path
  p.formulaLock = { locked: true, cogs: { cogsPerUnit: cb.cogsPerUnit } };
  return p;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const codes = (r, bucket) => r[bucket].map((e) => e.code);
const hasErr  = (r, code) => codes(r, "errors").includes(code);
const hasWarn = (r, code) => codes(r, "warnings").includes(code);

// ══ 0. sanity: the derivation matches the hand math ═══════════════════════════
(() => {
  const der = B.deriveActiveCPU(cleanProject(), INV);
  // A: 500*1.03/1 = 515mg = .515g × $0.02 = $0.0103 ; B: 250*1.03/.5 = 515mg × $0.10 = $0.0515
  // per serving = $0.0618 ; × 30 servings/bottle = $1.854 / bottle
  A(B._close(der.activeCPS, 0.0618), "active $/serving re-derives to $0.0618");
  A(B._close(der.activeCPU, 1.854), "active $/bottle re-derives to $1.854 (× 30 servings)");
  A(der.servPerUnit === 30, "servings per costing unit = 60 caps / 2 = 30");
})();

// ══ 1. the clean project passes EVERYTHING — 0 errors, 0 warnings ═════════════
(() => {
  const r = B.reconcile(cleanProject(), INV);
  A(r.ok === true, "clean project reconciles ok");
  A(r.errors.length === 0, "clean project has 0 errors, got: " + JSON.stringify(codes(r, "errors")));
  A(r.warnings.length === 0, "clean project has 0 warnings, got: " + JSON.stringify(codes(r, "warnings")));
  // every invariant that applies to a clean capsule fixture actually ran
  const ran = r.checks.map((c) => c.code);
  ["PN_FORMAT", "FORMULA_HAS_ACTIVES", "SKU_RESOLVE", "COGS_MATERIALS_ADDITIVE",
   "COGS_TOTAL_ADDITIVE", "ACTIVE_COST_DRIFT", "COGS_POSITIVE", "TIER_MONOTONIC",
   "MARGIN_NONNEG", "MFSO_FORMULA_TIE", "LOCK_NO_DRIFT"].forEach((c) =>
    A(ran.includes(c), "invariant " + c + " ran on the clean fixture"));
})();

// ══ 2. each injected fault trips EXACTLY the right invariant code ═════════════

// (a) malformed project number → PN_FORMAT (blocking)
(() => { const p = clone(cleanProject()); p.pn = "P262112";
  A(hasErr(B.reconcile(p, INV), "PN_FORMAT"), "malformed PN trips PN_FORMAT"); })();

// (b) no dosed ingredient → FORMULA_HAS_ACTIVES (blocking)
(() => { const p = clone(cleanProject()); p.ingredients.forEach((r) => (r.inputMg = 0));
  A(hasErr(B.reconcile(p, INV), "FORMULA_HAS_ACTIVES"), "empty formula trips FORMULA_HAS_ACTIVES"); })();

// (c) an active with no priced SKU → SKU_RESOLVE (blocking) — COGS would be understated
(() => { const p = clone(cleanProject()); p.ingredients[1].importedAlt = "GHOST"; p.ingredients[1].item = { n: "GHOST" };
  A(hasErr(B.reconcile(p, INV), "SKU_RESOLVE"), "unpriced active trips SKU_RESOLVE"); })();

// (d) direct-materials don't sum → COGS_MATERIALS_ADDITIVE (blocking)
(() => { const p = clone(cleanProject()); p.cogsBreakdown.materialsCPU = 99;
  A(hasErr(B.reconcile(p, INV), "COGS_MATERIALS_ADDITIVE"), "broken materials sum trips COGS_MATERIALS_ADDITIVE"); })();

// (e) COGS total doesn't sum → COGS_TOTAL_ADDITIVE (blocking)
(() => { const p = clone(cleanProject()); delete p.formulaLock; p.cogsBreakdown.cogsPerUnit = 99;
  A(hasErr(B.reconcile(p, INV), "COGS_TOTAL_ADDITIVE"), "broken COGS total trips COGS_TOTAL_ADDITIVE"); })();

// (f) formula edited but stored active cost never recomputed → ACTIVE_COST_DRIFT (advisory)
//     mutate an INPUT (not the breakdown) so materials still self-sum but re-derivation diverges.
(() => { const p = clone(cleanProject()); p.ingredients[0].inputMg = 250;
  const r = B.reconcile(p, INV);
  A(hasWarn(r, "ACTIVE_COST_DRIFT"), "stale active cost trips ACTIVE_COST_DRIFT (warn)");
  A(!hasErr(r, "COGS_MATERIALS_ADDITIVE"), "drift alone does NOT false-trip materials additivity"); })();

// (g) stick pack packaged like a bottle → STICK_CONTAINER (blocking)
(() => { const p = clone(cleanProject()); p.dosageForm = "Powder Stick Pack";
  p.pkg = { container: { n: "BTL" }, foil: { n: "FOIL" } };
  A(hasErr(B.reconcile(p, INV), "STICK_CONTAINER"), "stick pack in a bottle trips STICK_CONTAINER"); })();

// (h) a quoted tier below COGS → MARGIN_NONNEG (advisory, underwater price)
(() => { const p = clone(cleanProject()); p.tierPricing = [{ units: 1000, price: 3.00 }];
  A(hasWarn(B.reconcile(p, INV), "MARGIN_NONNEG"), "underwater tier trips MARGIN_NONNEG (warn)"); })();

// (i) tier price RISES with quantity → TIER_MONOTONIC (advisory)
(() => { const p = clone(cleanProject()); p.tierPricing = [{ units: 1000, price: 6.00 }, { units: 5000, price: 7.00 }];
  A(hasWarn(B.reconcile(p, INV), "TIER_MONOTONIC"), "non-monotonic tiers trip TIER_MONOTONIC (warn)"); })();

// (j) edited MFSO drops an active → MFSO_FORMULA_TIE (advisory)
(() => { const p = clone(cleanProject()); p.mfso.composition = [{ input: 500 }];
  A(hasWarn(B.reconcile(p, INV), "MFSO_FORMULA_TIE"), "MFSO missing an active trips MFSO_FORMULA_TIE (warn)"); })();

// (k) approved/locked COGS drifted from live → LOCK_NO_DRIFT (blocking)
(() => { const p = clone(cleanProject()); p.formulaLock.cogs.cogsPerUnit = 4.00;
  A(hasErr(B.reconcile(p, INV), "LOCK_NO_DRIFT"), "approved-cost drift trips LOCK_NO_DRIFT"); })();

// (l) bulk order not priced per single piece → BULK_UOM (blocking)
(() => { const p = clone(cleanProject()); p.cogsBreakdown.isBulk = true; // ppc still 60
  A(hasErr(B.reconcile(p, INV), "BULK_UOM"), "bulk with ppc≠1 trips BULK_UOM"); })();

// (m) an IMPORT stub (rolled materialsCPU, null component parts) must NOT false-trip additivity
(() => { const p = clone(cleanProject());
  p.cogsBreakdown = { activeCPU: null, baseCPU: null, shellCPU: null, pkgCPU: null,
    materialsCPU: 3.20, laborPerUnit: 0.85, overheadCPU: 0.45, cogsPerUnit: 4.50,
    isBulk: false, piecesPerContainer: 60, source: "import" };
  delete p.formulaLock;
  const r = B.reconcile(p, INV);
  A(!hasErr(r, "COGS_MATERIALS_ADDITIVE"), "import stub does NOT false-trip COGS_MATERIALS_ADDITIVE");
  A(!hasErr(r, "COGS_TOTAL_ADDITIVE"), "import stub does NOT false-trip COGS_TOTAL_ADDITIVE");
  A(r.checks.some((c) => c.code === "COGS_POSITIVE" && c.ok), "import stub still runs COGS_POSITIVE"); })();

// ══ 3. contracts: PN helpers + schema + skuCost override + batchBasis ═════════
(() => {
  A(B.isValidPN("P26205") && !B.isValidPN("P262112"), "isValidPN accepts P26205, rejects P262112");
  A(B.pnParts("P26204").seq === 204 && B.pnParts("garbage") === null, "pnParts splits / rejects");
  const nx = B.nextPN([{ pn: "P26204" }, { pn: "P262112" }, { pn: "P25999" }]);
  A(B.isValidPN(nx), "nextPN returns a well-formed number: " + nx);
  A(nx === "P" + String(B.pnYear()).padStart(2, "0") + "205", "nextPN ignores malformed + prior-year, = ...205, got " + nx);

  const sch = B.validateSchema({ pn: "P262112", ingredients: "nope", tierPricing: [{ units: -5, price: -1 }] });
  A(!sch.ok, "validateSchema flags a malformed project");
  A(sch.errors.some((e) => /malformed/i.test(e)), "schema catches the malformed PN");
  A(sch.errors.some((e) => /ingredients/i.test(e)), "schema catches non-array ingredients");
  A(B.validateSchema(cleanProject()).ok, "validateSchema passes the clean project");

  // per-project cost override beats the inventory price
  const p = cleanProject(); p.costOverride = { "ACT-A": 0.99 };
  A(B.skuCost("ACT-A", p, INV) === 0.99, "costOverride wins over inventory");
  A(B.skuCost("ACT-B", p, INV) === 0.10, "un-overridden SKU still reads inventory");
  A(B.skuCost("GHOST", p, INV) === null, "an unknown SKU with no override → null (unresolved)");

  const bb = B.batchBasis({ servingSize: 2, servingsPerUnit: 30, batchUnits: 1000,
    cogsBreakdown: { isBulk: false, piecesPerContainer: 60 } });
  A(bb.servPerUnit === 30 && bb.pieces === 60000, "batchBasis: 30 serv/unit, 60k pieces / 1000-bottle batch");
  const bulk = B.batchBasis({ servingSize: 1, isBulk: true, batchUnits: 500, cogsBreakdown: { isBulk: true, piecesPerContainer: 1 } });
  A(bulk.piecesPerContainer === 1, "bulk basis is 1 piece / costing unit");
})();

console.log(fail === 0 ? "ENOVA BRAIN KERNEL CHECKS PASSED" : fail + " FAILED");
process.exit(fail ? 1 : 0);
