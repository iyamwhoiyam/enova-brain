// ─────────────────────────────────────────────────────────────────────────────
// Kernel BASE golden lock — EnovaBrain.gummyBase() vs an INDEPENDENT reference implementation.
// The gummy base logic + KB now live ONLY in the kernel (the app delegates, §43/§44), so this test
// carries its OWN frozen copy of the displacement algorithm + base KB as the golden spec. If the
// kernel's base math or KB ever drifts from this spec, this fails — a conscious, reviewed change.
// (test_gummy.js separately proves the kernel against the real P26206 MISys workbook values.)
// ─────────────────────────────────────────────────────────────────────────────
const B = require((process.env.ENOVA_KERNEL||require("path").join(__dirname,"enova_brain.js")));
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-9;

// ── FROZEN reference KB (the golden spec — do not edit without a reviewed base change) ──
const REF_SUGAR = [
  { name: "Sugar Granulated", rm: "ALT-RP-0529", bulk: true, ratio: 0.6136, section: "body" },
  { name: "42/43 DE Corn Syrup / Glucose", rm: "ALT-RL-1381", bulk: true, ratio: 0.3864, section: "body" },
  { name: "Slow Set Pectin CS502", rm: "ALT-RP-2013", pct: 0.015, section: "body" },
  { name: "Citric Acid Anhydrous", rm: "ALT-RP-0003", pct: 0.007, section: "body" },
  { name: "Sodium Citrate", rm: "ALT-RP-1859", pct: 0.003, section: "body" },
  { name: "Water (R/O)", rm: "ALT-RP-0000", pct: 0.085, nc: true, section: "body" },
  { name: "Liquid Flavor", rm: "ALT-RL-0111", pct: 0.005, section: "body" },
  { name: "Liquid Color", rm: "ALT-RP-2026", pct: 0.002, section: "body" },
  { name: "MCT Oil — Bottom Coat", rm: "ALT-RL-1272", mgFixed: 60, coating: true, section: "coating" },
  { name: "Sunflower Lecithin", rm: "ALT-RP-0618-GP-VS", mgFixed: 7, coating: true, section: "coating" },
  { name: "Mastercoat ASFC3000", rm: "ALT-RL-2247", mgFixed: 20, coating: true, section: "coating" },
  { name: "MCT Oil — Top Coat", rm: "ALT-RL-1272", mgFixed: 95, coating: true, section: "coating" },
  { name: "Sugar — Dusting", rm: "ALT-RP-0529", mgFixed: 200, coating: true, section: "coating" },
];
const REF_SF = [
  { name: "Sorbitol Gran", rm: "ALT-RP-1247", bulk: true, ratio: 0.6870, section: "body" },
  { name: "Maltitol 80-55 Syrup", rm: "ALT-RL-1389", bulk: true, ratio: 0.3130, section: "body" },
  { name: "Slow Set Pectin CS509", rm: "ALT-RP-2101", pct: 0.030, section: "body" },
  { name: "R/O Water", rm: "ALT-RP-0000", pct: 0.12167, nc: true, section: "body" },
  { name: "Citric Acid Anhydrous", rm: "ALT-RP-0003", pct: 0.007, section: "body" },
  { name: "Vegetable Glycerin, Kosher", rm: "ALT-RL-0028", pct: 0.020, section: "body" },
  { name: "Sodium Citrate", rm: "ALT-RP-1859", pct: 0.003, section: "body" },
  { name: "Calcium Citrate 21%", rm: "ALT-RP-0126", pct: 0.006, section: "body" },
  { name: "MCT Oil /3595 Kosher", rm: "ALT-RL-1272", pct: 0.003, section: "body" },
  { name: "Sunflower Lecithin", rm: "ALT-RP-0618-GP-VS", pct: 0.0015, section: "body" },
  { name: "Liquid Flavor", rm: "ALT-RL-0111", pct: 0.015, section: "body" },
  { name: "Liquid Color", rm: "ALT-RP-2026", pct: 0.010, section: "body" },
  { name: "Bitter Masker 3115B", rm: "ALT-RP-1446", pct: 0.003, section: "body" },
  { name: "Mastercoat ASFC3000", rm: "ALT-RL-2247", pct: 0.005, coating: true, section: "coating" },
];
function refActivesMg(p) {
  const serv = Number(p.servingSize) || 1; let m = 0;
  (p.ingredients || []).forEach((r) => { const pot = r.potencyPct > 0 ? r.potencyPct / 100 : 1; m += (Number(r.inputMg) || 0) / pot; });
  return serv > 0 ? m / serv : m;
}
function refBase(proj, invIx, bulk) {
  const baseT = proj.gummyType === "sugarFree" ? REF_SF : REF_SUGAR;
  const gw = Number(proj.gummyWt) > 0 ? Number(proj.gummyWt) : 4500;
  const items = baseT.filter((t) => !(t.coating && bulk));
  const actMg = refActivesMg(proj);
  const nonBulkMg = (t) => (t.mgFixed != null ? t.mgFixed : (Number(t.pct) || 0) * gw);
  const fixedSum = items.reduce((s, t) => s + (t.bulk ? 0 : nonBulkMg(t)), 0);
  const remainder = Math.max(0, gw - actMg - fixedSum);
  const ratioSum = items.reduce((s, t) => s + (t.bulk ? (Number(t.ratio) || 0) : 0), 0) || 1;
  return items.map((t) => {
    const mgG = t.bulk ? remainder * ((Number(t.ratio) || 0) / ratioSum) : nonBulkMg(t);
    const fresh = t.rm ? (invIx[t.rm] || null) : null;
    const cost = (!t.nc && fresh && fresh.u > 0) ? (mgG / 1000) * fresh.u : 0;
    return { name: t.name, mgG, cost };
  });
}

// controlled inventory (distinct $/g so any mismatch shows)
const INV = {
  "ALT-RP-0529": { u: 0.0011 }, "ALT-RL-1381": { u: 0.0013 }, "ALT-RP-2013": { u: 0.0250 },
  "ALT-RP-0003": { u: 0.0040 }, "ALT-RP-1859": { u: 0.0060 }, "ALT-RP-0000": { u: 0.0 },
  "ALT-RL-0111": { u: 0.0300 }, "ALT-RP-2026": { u: 0.0400 }, "ALT-RL-1272": { u: 0.0090 },
  "ALT-RP-0618-GP-VS": { u: 0.0700 }, "ALT-RL-2247": { u: 0.1200 },
  "ALT-RP-1247": { u: 0.0015 }, "ALT-RL-1389": { u: 0.0017 }, "ALT-RP-2101": { u: 0.0260 },
  "ALT-RL-0028": { u: 0.0080 }, "ALT-RP-0126": { u: 0.0100 }, "ALT-RP-1446": { u: 0.0500 },
};

// KB integrity — the kernel's embedded KB matches the frozen spec (rm, ratio/pct/mgFixed, order)
A(B.GUMMY_SUGAR_BASE.length === REF_SUGAR.length && B.GUMMY_SF_BASE.length === REF_SF.length, "kernel base KB row counts match the spec");
const kbOk = B.GUMMY_SUGAR_BASE.every((r, i) => r.rm === REF_SUGAR[i].rm && r.name === REF_SUGAR[i].name
  && near(r.ratio || 0, REF_SUGAR[i].ratio || 0) && near(r.pct || 0, REF_SUGAR[i].pct || 0) && (r.mgFixed || 0) === (REF_SUGAR[i].mgFixed || 0))
  && B.GUMMY_SF_BASE.every((r, i) => r.rm === REF_SF[i].rm && r.name === REF_SF[i].name
  && near(r.ratio || 0, REF_SF[i].ratio || 0) && near(r.pct || 0, REF_SF[i].pct || 0) && (r.mgFixed || 0) === (REF_SF[i].mgFixed || 0));
A(kbOk, "kernel base KB matches the frozen spec row-for-row (rm/ratio/pct/mgFixed)");

function mk(type, wt, actives, isBulk) {
  return { dosageForm: "Gummies", gummyType: type, gummyWt: wt, servingSize: 2, isBulk: !!isBulk,
    ingredients: actives.map((mg) => ({ inputMg: mg, potencyPct: 100, item: { n: "ACT" } })) };
}
const CASES = [
  ["sugar retail light", mk("sugar", 4500, [1000], false), false],
  ["sugar retail heavy", mk("sugar", 4500, [2000, 800], false), false],
  ["sugar bulk", mk("sugar", 4500, [1500], true), true],
  ["SF retail", mk("sugarFree", 3000, [500, 250], false), false],
  ["SF bulk", mk("sugarFree", 3000, [900], true), true],
  ["sugar tiny wt", mk("sugar", 2500, [300], false), false],
];
for (const [label, proj, bulk] of CASES) {
  const kb = B.gummyBase(proj, { invIx: INV, bulk });
  const ref = refBase(proj, INV, bulk);
  A(kb.rows.length === ref.length, `${label}: same row count (kernel ${kb.rows.length} vs ref ${ref.length})`);
  let ok = kb.rows.length === ref.length;
  for (let i = 0; i < Math.min(kb.rows.length, ref.length); i++) {
    if (!near(kb.rows[i].mgG, ref[i].mgG)) { ok = false; A(false, `${label} row ${i} (${ref[i].name}): mgG ${kb.rows[i].mgG} vs ${ref[i].mgG}`); }
    if (!near(kb.rows[i].cost, ref[i].cost)) { ok = false; A(false, `${label} row ${i} (${ref[i].name}): cost ${kb.rows[i].cost} vs ${ref[i].cost}`); }
  }
  A(ok, `${label}: every base row ties to the golden spec (mgG + cost)`);
  A(near(kb.costPerPiece, ref.reduce((s, r) => s + r.cost, 0)), `${label}: base cost/gummy ties the spec`);
  A(near(kb.totalMg, Number(proj.gummyWt)), `${label}: actives + base == gummyWt (displacement exact)`);
}

console.log(fail === 0 ? "ENOVA BRAIN BASE GOLDEN LOCK PASSED (kernel === frozen spec)" : fail + " FAILED");
process.exit(fail ? 1 : 0);
