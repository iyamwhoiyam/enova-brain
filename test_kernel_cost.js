// ─────────────────────────────────────────────────────────────────────────────
// EnovaBrain.cost — arithmetic lock (Node, fast, deterministic).
// Proves the kernel's costing core computes the COGS build exactly as specified:
//   • actives (override-aware, per-ingredient overage, potency), scaled to the costing unit
//   • gummy base, shell, packaging per-unit/per-case split with house-standard overrides
//   • Master Bid path (injected engine) AND the manual %+% fallback
//   • the freight/loss (dmExtra) delta and the full breakdown assembly
// The real-browser PENNY-parity vs the live app is test_kernel_cost_browser.js.
// ─────────────────────────────────────────────────────────────────────────────
const B = require((process.env.ENOVA_KERNEL||require("path").join(__dirname,"enova_brain.js")));
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-9 : t);

const INV = { "ACT-A": { u: 0.02 }, "ACT-B": { u: 0.10 }, "SHELL": { u: 0.01 }, "BTL": { u: 0.12 }, "CAP": { u: 0.03 }, "LBL": { u: 0.0558 }, "SHIP": { u: 3.60 } };

// A capsule project: 2 caps/serving, 30 servings/bottle = 60 caps/bottle.
function capProj() {
  return {
    pn: "P26205", dosageForm: "Capsules", isBulk: false, overage: 0.03,
    servingSize: 2, servingsPerUnit: 30, unitsPerContainer: 60, batchUnits: 5000,
    materialLoss: 0.02, overheadPct: 0.15,
    ingredients: [
      { importedAlt: "ACT-A", inputMg: 500, potencyPct: 100, item: { n: "ACT-A" } },
      { importedAlt: "ACT-B", inputMg: 250, potencyPct: 50,  item: { n: "ACT-B" } },
    ],
    shellItem: { n: "SHELL" },
    pkg: { container: { n: "BTL" }, closure: { n: "CAP" }, label: { n: "LBL" }, shipper: { n: "SHIP" } },
  };
}
// Container/form context the app would resolve and inject.
function capCtx(overrides) {
  return Object.assign({
    invIx: INV,
    container: "Bottle",
    ctInfo: { bulk: false, pkg: [{ k: "container" }, { k: "closure" }, { k: "label" }, { k: "shipper" }] },
    cfg: { gummy: false, shell: true, bulk: false, laborDefault: 0.5, moq: 5000 },
    unitNounForForm: "Capsule",
    mbForm: "capsule",
    masterBid: null,                       // manual path unless overridden
    baseCostPerPiece: 0,
    casePack: 12,
    constants: { label: 0.15, stickpack: 0.15, stickDisplay: 1.00 },
  }, overrides || {});
}

// ══ 1. actives + materials arithmetic (manual labor path) ═════════════════════
(() => {
  const r = B.cost(capProj(), capCtx());
  const v = r.view, b = r.breakdown;
  // A: 500*1.03/1 = 515mg=.515g × $0.02 = $0.0103 ; B: 250*1.03/.5 = 515mg × $0.10 = $0.0515
  A(near(v.actCPS, 0.0618, 1e-9), "actCPS = $0.0618/serving, got " + v.actCPS);
  A(v.mbServings === 30, "servings/costing unit = 60/2 = 30");
  A(near(b.activeCPU, 1.854, 1e-9), "activeCPU = $1.854/bottle (0.0618 × 30), got " + b.activeCPU);
  A(near(b.shellCPU, 0.60, 1e-9), "shellCPU = $0.01 × 60 caps = $0.60");
  // packaging: container 0.12 + closure 0.03 + label PINNED to 0.15 (per-unit); shipper 3.60 per-case/12 = 0.30
  A(near(v.pkgPerUnit, 0.12 + 0.03 + 0.15, 1e-9), "per-unit packaging = 0.30 (label pinned to $0.15), got " + v.pkgPerUnit);
  A(near(v.pkgPerCase, 3.60, 1e-9), "per-case packaging (shipper) = $3.60");
  A(near(b.pkgCPU, 0.30 + 3.60 / 12, 1e-9), "pkgCPU = 0.30 + 3.60/12 = 0.60, got " + b.pkgCPU);
  A(near(b.materialsCPU, 1.854 + 0.60 + 0.60, 1e-9), "materialsCPU = active+shell+pkg = 3.054, got " + b.materialsCPU);
  // manual fallback: overhead = materials*.15 + laborManual*.15 ; cogs = materials + laborManual + overhead
  const laborManual = 0.5, oh = 3.054 * 0.15 + laborManual * 0.15;
  A(b.source === "manual", "no MB engine → manual source");
  A(near(b.overheadCPU, oh, 1e-9), "manual overhead = materials*.15 + labor*.15");
  A(near(b.cogsPerUnit, 3.054 + laborManual + oh, 1e-9), "manual cogs = materials+labor+overhead, got " + b.cogsPerUnit);
  A(b.dmExtraCPU === 0, "manual path has no freight/loss delta");
  A(b.piecesPerContainer === 60 && b.isBulk === false && b.container === "Bottle", "breakdown carries pack context");
})();

// ══ 2. per-project cost override flows into COGS ══════════════════════════════
(() => {
  const p = capProj(); p.costOverride = { "ACT-A": 0.99 };   // $/g override wins over inventory
  const r = B.cost(p, capCtx());
  // A now: .515g × $0.99 = $0.50985 ; B unchanged $0.0515 → /serving 0.56135 × 30 = 16.8405
  A(near(r.breakdown.activeCPU, (0.515 * 0.99 + 0.0515) * 30, 1e-9), "override raises activeCPU, got " + r.breakdown.activeCPU);
})();

// ══ 3. Master Bid path (injected engine) drives labor/overhead + freight delta ═
(() => {
  // Minimal fake MB mirroring the real engine's cost identity:
  //   dml = dm_unit*qty + freight + loss ; total = dml+labor+overhead ; per-unit = /qty
  const fakeMB = {
    MB_DEFAULTS: {},
    build(_def, inp, qty) {
      const dml = inp.dm_unit * qty + 100 /*freight*/ + inp.dm_unit * qty * inp.loss;
      const labor = 0.8 * qty, overhead = 0.4 * qty, total = dml + labor + overhead;
      return { qty, dml, labor, overhead, total, cost_per_unit: total / qty,
        labor_per_unit: labor / qty, oh_per_unit: overhead / qty, blends: 1 };
    },
  };
  const r = B.cost(capProj(), capCtx({ masterBid: fakeMB }));
  const b = r.breakdown, qty = 5000, mats = b.materialsCPU;
  A(b.source === "masterbid", "MB present → masterbid source");
  A(near(b.laborPerUnit, 0.8, 1e-9), "MB labor/unit = 0.8");
  A(near(b.overheadCPU, 0.4, 1e-9), "MB overhead/unit = 0.4");
  const dml = mats * qty + 100 + mats * qty * 0.02;
  A(near(b.cogsPerUnit, (dml + 0.8 * qty + 0.4 * qty) / qty, 1e-9), "MB cogs/unit ties to the engine identity");
  A(near(b.dmExtraCPU, dml / qty - mats, 1e-9), "dmExtra = landed materials/unit − materials/unit (freight+loss)");
  A(b.mbBatchQty === 5000 && b.mbForm === "capsule", "breakdown records MB batch + form");
})();

// ══ 4. bulk order: 1 piece = the costing unit, ALL packaging spread per case ═══
(() => {
  const p = capProj(); p.isBulk = true;
  const ctx = capCtx({ ctInfo: { bulk: true, pkg: [{ k: "bag" }, { k: "shipper" }] },
    cfg: { gummy: false, shell: true, bulk: true, laborDefault: 0.5, moq: 5000 },
    casePack: 1000, unitNounForForm: "Capsule" });
  p.pkg = { bag: { n: "BTL" }, shipper: { n: "SHIP" } };
  const r = B.cost(p, ctx);
  A(r.view.piecesPerContainer === 1, "bulk costing unit = 1 piece");
  A(r.view.pkgPerUnit === 0, "bulk: no per-unit packaging (all per-case)");
  A(near(r.view.pkgPerCase, 0.12 + 3.60, 1e-9), "bulk: bag + shipper both per-case");
  A(near(r.breakdown.pkgCPU, (0.12 + 3.60) / 1000, 1e-9), "bulk pkgCPU spread across 1000/case");
  A(r.breakdown.isBulk === true && r.breakdown.unitNoun === "Capsule", "bulk unit noun from form");
})();

// ══ 5. stick pack: foil per-stick + display per-unit house standard ═══════════
(() => {
  const p = { pn: "P26206", dosageForm: "Powder Stick Pack", isBulk: false, overage: 0.03,
    servingSize: 1, servingsPerUnit: 28, unitsPerContainer: 28, batchUnits: 5000,
    ingredients: [{ importedAlt: "ACT-A", inputMg: 1000, potencyPct: 100, item: { n: "ACT-A" } }],
    pkg: { foil: { n: "LBL" }, display: { n: "BTL" }, shipper: { n: "SHIP" } } };
  const ctx = capCtx({ container: "Stick-Pack Box",
    ctInfo: { bulk: false, pkg: [{ k: "foil" }, { k: "display" }, { k: "shipper" }] },
    cfg: { gummy: false, shell: false, bulk: false, laborDefault: 0.5, moq: 5000 },
    mbForm: "stickpack", casePack: 24 });
  const r = B.cost(p, ctx);
  // 28 sticks × $0.15 foil = $4.20 per-unit ; display $1.00 per-unit ; shipper $3.60 per-case
  A(near(r.view.pkgPerUnit, 28 * 0.15 + 1.00, 1e-9), "stick foil $0.15×28 + display $1.00 per-unit, got " + r.view.pkgPerUnit);
  A(near(r.view.pkgPerCase, 3.60, 1e-9), "stick shipper is per-case");
  A(r.breakdown.shellCPU === 0, "stick pack has no shell");
})();

console.log(fail === 0 ? "ENOVA BRAIN COST-CORE CHECKS PASSED" : fail + " FAILED");
process.exit(fail ? 1 : 0);
