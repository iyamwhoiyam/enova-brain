// §33 — validate the deterministic capsule generator against Enova's REAL capsule formulas (corpus)
// and against synthetic shell/fill cases. The house-standard flow level (0.75% of actives) must match
// what Enova actually used; the MCC balance-to-shell must be correct. No AI, no invention.
const fs = require("fs");
// Load the EMBEDDED engine from the shipped app (not the standalone file) so the suite validates
// exactly what deploys.
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
const blk = html.match(/<script id="enova-formulator">([\s\S]*?)<\/script>/);
if (!blk) { console.log("FAIL: enova-formulator engine block not found in app"); process.exit(1); }
const EF = new Function("self", "module", blk[1] + "\n;return self.EnovaFormulator;")({}, undefined);
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const SYS = new Set(["ALT-RP-0472", "ALT-RP-0387", "ALT-RP-0493"]); // mag stearate, silica, MCC

// ── Part A: regenerate each real capsule formula's system from its actives ──
if (fs.existsSync((process.env.ENOVA_REFS||require("path").join(__dirname,"refs"))+"/corpus_extract.json")) {
  const rows = JSON.parse(fs.readFileSync((process.env.ENOVA_REFS||require("path").join(__dirname,"refs"))+"/corpus_extract.json", "utf8"));
  const caps = {};
  for (const r of rows) if (r.form === "Capsules") { const pn = r.pn || r.file; if (!caps[pn] || r.ings.length >= caps[pn].ings.length) caps[pn] = r; }
  console.log("Capsule products in corpus:", Object.keys(caps).length);
  let matched = 0, checked = 0;
  for (const pn in caps) {
    const r = caps[pn];
    const actives = r.ings.filter(i => !SYS.has(i.rm) && Number(i.mg) > 0).map(i => ({ name: i.name, alt: i.rm || null, mg: i.mg }));
    if (!actives.length) continue;
    const out = EF.build("Capsules", { actives, servingSize: 1 });
    A(out.rows.length >= actives.length, pn + ": engine returns >= actives rows");
    // actual flow the sheet used
    const actualMg = r.ings.filter(i => i.rm === "ALT-RP-0472").reduce((s, i) => s + (i.mg || 0), 0);
    const activesMg = actives.reduce((s, a) => s + a.mg, 0);
    const engMg = (out.rows.find(x => x.alt === "ALT-RP-0472") || {}).mg || 0;
    if (actualMg > 0) {
      checked++;
      const actualPct = 100 * actualMg / activesMg;
      const near = Math.abs(engMg - actualMg) <= Math.max(2, 0.004 * activesMg); // within ~0.4% of actives or 2mg
      if (near) matched++;
      console.log(`  ${r.product.slice(0,30).padEnd(30)} actives ${activesMg.toFixed(0).padStart(6)}mg · MgSt actual ${actualMg}mg (${actualPct.toFixed(2)}%) · engine ${engMg}mg  ${near?"✓":"(differs — non-standard formula)"}`);
    }
  }
  A(checked >= 3, "found >=3 capsule formulas using the flow standard to validate against");
  A(matched >= Math.ceil(checked * 0.6), `engine's 0.75% flow matches the majority of standard formulas (${matched}/${checked})`);
} else {
  console.log("(corpus_extract.json absent — skipping corpus validation)");
}

// ── Part B: deterministic shell + MCC balance (synthetic, exact) ──
const T = (actives, ss) => EF.build("Capsules", { actives: actives.map((mg, i) => ({ name: "Active" + i, alt: "ALT-X" + i, mg })), servingSize: ss });
let o;
o = T([350], 1);  A(o.shell === "2" && o.rows.every(r => r.role !== "Fill / bulking"), "350mg active (+flow ≈355) → size 2, no MCC (got " + o.shell + ")");
o = T([400], 1);  A(o.shell === "1", "400mg active (+flow=406) exceeds size 2 → size 1 (got " + o.shell + ")");
o = T([60], 1);   const mcc60 = (o.rows.find(r => r.alt === "ALT-RP-0493") || {}).mg || 0;
                  A(o.shell === "5" && mcc60 > 0, "60mg active → size 5 with MCC fill (shell " + o.shell + ", mcc " + mcc60 + ")");
o = T([3000], 1); A(o.warnings.some(w => /exceeds/.test(w)), "3000mg in 1 capsule → over-capacity warning");
o = T([3000], 3); A(o.shell === "000" && !o.warnings.some(w => /exceeds/.test(w)), "3000mg over 3 capsules → size 000, no warning (got " + o.shell + ")");
// flow level is exactly 0.75% of actives
o = T([1000], 1); const mg = (o.rows.find(r => r.alt === "ALT-RP-0472") || {}).mg;
                  A(Math.abs(mg - 7.5) < 0.01, "Mag Stearate = 0.75% of 1000mg actives = 7.5mg (got " + mg + ")");

console.log("\n" + (fail === 0 ? "CAPSULE FORMULATOR CHECKS PASSED" : fail + " FAILED"));
process.exit(fail ? 1 : 0);
