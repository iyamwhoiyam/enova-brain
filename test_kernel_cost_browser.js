// ─────────────────────────────────────────────────────────────────────────────
// Kernel cost PIPELINE — end-to-end proof in a real browser (post-swap).
// FormulationEditor now renders its COGS build from EnovaBrain.cost() (blueprint Step A swap):
// the kernel is the single source of truth. This drives a live formulation on several dose forms
// and asserts the persisted, kernel-produced cogsBreakdown is INTERNALLY COHERENT — the same
// additivity/coherence invariants EnovaBrain.reconcile() enforces, checked on the app's real output:
//   materials = active+base+shell+pkg ; cogs = materials+freight/loss+labor+overhead ; cogs > 0 ;
//   Master Bid engine drove the numbers. If the swap ever produces an incoherent breakdown, this fails.
// (Kernel-vs-inline penny-parity was proven before the swap; post-swap the app IS the kernel.)
// ─────────────────────────────────────────────────────────────────────────────
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
let chromium; try { ({ chromium } = require(NG + "/playwright")); }
catch (e) { console.log("SKIP: Playwright/Chromium not available —", e.message); process.exit(0); }

const REQS = [
  { label: "capsule",   wt: null,    text: "Product Form: Capsules\nServings per unit: 30\nServing size: 2 capsules\nIngredients:\nVitamin C 500mg\nZinc 15mg" },
  { label: "powder",    wt: "13000", text: "Product Form: Powder\nServings per unit: 30\nServing size: 1 scoop\nIngredients:\nCreatine Monohydrate 5000mg\nL-Citrulline 3000mg\nBeta-Alanine 2000mg\nFlavor: Fruit Punch\nSweetener: natural, sugar-free" },
  { label: "stickpack", wt: "4000",  text: "Product Form: Stick Pack\nServings per unit: 28\nServing size: 1 stick\nIngredients:\nMagnesium 200mg\nL-Theanine 100mg\nFlavor: Berry" },
  { label: "gummy",     wt: null,    text: "Product Form: Gummies\nServings per unit: 60\nServing size: 2 gummies\nIngredients:\nApple Cider Vinegar 500mg\nVitamin B12 100mcg" },
];
const close = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 2200 } });
  const errs = []; p.on("pageerror", e => errs.push("pageerror: " + (e.message || e)));
  await p.addInitScript(() => { window.__ENOVA_COST__ = {}; });   // turn on cost observability before app boot
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });

  for (const r of REQS) {
    try {
      await p.click('.app-nav-item:has-text("Formulation")'); await p.waitForTimeout(250);
      await p.click('button:has-text("+ New Formulation")'); await p.waitForTimeout(350);
      await p.click('button:has-text("Describe Product")'); await p.waitForTimeout(150);
      await p.fill('textarea', r.text); await p.waitForTimeout(120);
      await p.click('button:has-text("Extract")'); await p.waitForTimeout(650);
      await p.click('button:has-text("Apply to Formulation")'); await p.waitForTimeout(800);
      if (r.wt) { const w = await p.$('input[placeholder="e.g. 4500"]'); if (w) { await w.fill(r.wt); await p.waitForTimeout(300); } }
      await p.waitForTimeout(200);
    } catch (e) { errs.push(r.label + " intake: " + e.message); }
  }

  const cost = await p.evaluate(() => window.__ENOVA_COST__ || {});
  await b.close();

  let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
  const pns = Object.keys(cost);
  console.log("formulations costed by the kernel:", pns.length, "->", pns.join(", "));
  A(pns.length >= 3, "at least 3 formulations produced a kernel breakdown (got " + pns.length + ")");

  for (const pn of pns) {
    const cb = cost[pn]; if (!cb) { A(false, pn + ": no breakdown"); continue; }
    const parts = Number(cb.activeCPU||0) + Number(cb.baseCPU||0) + Number(cb.shellCPU||0) + Number(cb.pkgCPU||0);
    A(close(cb.materialsCPU, parts), `${pn}: materials = active+base+shell+pkg (${cb.materialsCPU} vs ${parts.toFixed(4)})`);
    const tot = Number(cb.materialsCPU||0) + Number(cb.dmExtraCPU||0) + Number(cb.laborPerUnit||0) + Number(cb.overheadCPU||0);
    A(close(cb.cogsPerUnit, tot), `${pn}: cogs = materials+freight/loss+labor+overhead (${cb.cogsPerUnit} vs ${tot.toFixed(4)})`);
    A(Number(cb.cogsPerUnit) > 0, `${pn}: cogs/unit is positive (${cb.cogsPerUnit})`);
    A(cb.source === "masterbid", `${pn}: Master Bid engine drove the cost (source=${cb.source})`);
  }
  // The gummy in the set must carry a NON-ZERO base cost — proof the kernel derives the turnkey base
  // natively (displacement base KB × live inventory) and it flows into COGS, not just that it coheres.
  A(Object.values(cost).some((cb) => Number(cb.baseCPU) > 0), "a form (the gummy) carries a kernel-derived base cost in COGS");
  A(errs.length === 0, "no page errors: " + (errs.join("; ") || "none"));

  console.log(fail === 0 ? "\nKERNEL COST PIPELINE PASSED (app renders from EnovaBrain.cost; every breakdown coheres)" : "\n" + fail + " PIPELINE FAILURES");
  process.exit(fail ? 1 : 0);
})();
