// §33b/§35 — validate the deterministic Powder / Stickpack / Liquid generators. Guarantees:
//   (1) GROUNDING — every SKU the engine can EMIT resolves to a REAL item in the LIVE embedded
//       inventory (MISys refresh), with a real cost — no phantom/renumbered codes. (Historical
//       corpus codes drift; live inventory is the source of truth. Process water ALT-RP-0000 is
//       exempt — it is a near-zero, non-valued line MISys does not stock.)
//   (2) EXACT BALANCE — actives + system + balance component == the target serving weight/volume
//       to the milligram; over-target warns instead of silently truncating; no target → warns and
//       skips the balance (never guesses the fill).
const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
const blk = html.match(/<script id="enova-formulator">([\s\S]*?)<\/script>/);
if (!blk) { console.log("FAIL: enova-formulator engine block not found"); process.exit(1); }
const EF = new Function("self", "module", blk[1] + "\n;return self.EnovaFormulator;")({}, undefined);
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 0.05 : eps);
const roleActive = r => r.role === "Active";

// Live inventory (the shipped snapshot) — the grounding source of truth.
const INV = JSON.parse((html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || "[]");
const INV_IX = Object.fromEntries(INV.map(i => [i.n, i]));
const NON_INVENTORY = new Set(["ALT-RP-0000"]); // process water: near-zero, not a valued MISys item

// Every SKU the engine can EMIT (across ALL forms) must resolve in the live inventory.
(EF.SYSTEM_ALTS || []).forEach(alt => {
  if (NON_INVENTORY.has(alt)) return;
  A(!!INV_IX[alt], `engine system SKU ${alt} resolves in the live inventory (not a phantom code)`);
  if (INV_IX[alt]) A(INV_IX[alt].u > 0, `engine system SKU ${alt} has a real (>0) cost in inventory`);
});

// ── Part A: corpus grounding + exact balance for each additive form ──
if (fs.existsSync((process.env.ENOVA_REFS||require("path").join(__dirname,"refs"))+"/corpus_extract.json")) {
  const rows = JSON.parse(fs.readFileSync((process.env.ENOVA_REFS||require("path").join(__dirname,"refs"))+"/corpus_extract.json", "utf8"));
  const latest = {};
  for (const r of rows) { const pn = r.pn || r.file; const k = r.form + "|" + pn;
    if (!latest[k] || r.ings.length >= latest[k].ings.length) latest[k] = r; }
  const byForm = {}; Object.values(latest).forEach(r => { (byForm[r.form] = byForm[r.form] || []).push(r); });

  for (const form of ["Powder", "Stickpacks", "Liquid"]) {
    const prods = byForm[form] || [];
    if (!prods.length) { console.log(`(no ${form} corpus rows)`); continue; }
    // Every system SKU the engine can add for this form must resolve in the LIVE inventory
    // (process water exempt). This is stronger than corpus membership: it guarantees the generated
    // formula never contains a phantom/renumbered code that would show "search to match".
    const kb = EF.KB[form];
    const engineAlts = [ ...(kb.system || []).map(s => s.alt), kb.fill && kb.fill.alt ].filter(Boolean);
    engineAlts.forEach(alt => { if (NON_INVENTORY.has(alt)) return;
      A(!!INV_IX[alt], `${form}: engine SKU ${alt} resolves in the live inventory (real, purchasable)`); });

    let exact = 0, checked = 0;
    for (const r of prods) {
      const ings = r.ings.filter(i => typeof i.mg === "number" && i.mg > 0);
      const actives = ings.filter(i => i.cat === "active_or_unclassified").map(i => ({ name: i.name, alt: i.rm || null, mg: i.mg }));
      if (!actives.length) continue;
      const target = ings.reduce((s, i) => s + i.mg, 0);          // the sheet's real total blend
      const req = { actives, servingSize: 1 };
      if (form === "Liquid") req.targetServingMl = target / 1000;  // 1 g/mL → mg back to mL
      else req.targetServingMg = target;
      const out = EF.build(form, req);
      checked++;
      // actives preserved verbatim
      const outActives = out.rows.filter(roleActive);
      A(outActives.length === actives.length, `${form} ${r.pn}: all ${actives.length} actives preserved (got ${outActives.length})`);
      // every SKU the engine ADDED (non-active) resolves in the live inventory (water exempt)
      out.rows.filter(x => !roleActive(x) && x.alt && !NON_INVENTORY.has(x.alt)).forEach(x =>
        A(!!INV_IX[x.alt], `${form} ${r.pn}: added SKU ${x.alt} resolves in the live inventory`));
      // exact balance: total == target (unless the actives already exceed the target → must warn)
      const total = out.rows.reduce((s, x) => s + x.mg, 0);
      const activesMg = actives.reduce((s, a) => s + a.mg, 0);
      if (out.warnings.some(w => /exceed/.test(w))) {
        A(activesMg <= total, `${form} ${r.pn}: over-target correctly warned`);
      } else {
        if (near(total, target, Math.max(0.5, target * 1e-6))) exact++;
        A(near(total, target, Math.max(1, target * 1e-6)),
          `${form} ${r.pn}: balance exact — total ${Math.round(total)} == target ${Math.round(target)}`);
      }
    }
    console.log(`  ${form}: ${prods.length} products · ${engineAlts.length} engine SKUs all grounded · exact-balance ${exact}/${checked}`);
  }
} else {
  console.log("(corpus_extract.json absent — skipping corpus grounding)");
}

// ── Part B: deterministic synthetic cases (exact math) ──
// Powder: 8 g serving, 3 g actives → carrier balances the rest; total == 8000.
let o = EF.build("Powder", { actives: [{ name: "A", alt: "ALT-A", mg: 3000 }], targetServingMg: 8000 });
let bal = o.rows.find(r => r.source === "computed-balance");
A(bal && bal.alt === "ALT-RP-1578", "powder balance is maltodextrin carrier");
A(near(o.rows.reduce((s, r) => s + r.mg, 0), 8000, 0.5), "powder total == 8000 mg exactly");

// Stickpack: 4500 mg, exact balance, carrier present.
o = EF.build("Stickpacks", { actives: [{ name: "A", alt: "ALT-A", mg: 700 }], targetServingMg: 4500 });
A(near(o.rows.reduce((s, r) => s + r.mg, 0), 4500, 0.5), "stickpack total == 4500 mg exactly");

// Liquid: 60 mL shot → water balance; total == 60000 mg; preservatives at ~0.11% (scale with volume).
o = EF.build("Liquid", { actives: [{ name: "A", alt: "ALT-A", mg: 1500 }], targetServingMl: 60 });
const water = o.rows.find(r => r.source === "computed-balance");
A(water && water.alt === "ALT-RP-0000", "liquid balance is R/O water");
A(near(o.rows.reduce((s, r) => s + r.mg, 0), 60000, 0.5), "liquid total == 60000 mg exactly");
const ksorb = o.rows.find(r => r.alt === "ALT-RP-0001");
A(ksorb && near(ksorb.mg, 66, 0.5), "K-sorbate scales with volume: 0.11% of 60 mL = 66 mg (got " + (ksorb && ksorb.mg) + ")");
// preservative scales: same product at 250 mL → 275 mg
let o2 = EF.build("Liquid", { actives: [{ name: "A", alt: "ALT-A", mg: 1500 }], targetServingMl: 250 });
const ks2 = o2.rows.find(r => r.alt === "ALT-RP-0001");
A(ks2 && near(ks2.mg, 275, 0.5), "K-sorbate scales to 0.11% of 250 mL = 275 mg (got " + (ks2 && ks2.mg) + ")");
// taste (acid) does NOT scale — same corpus-median dose at 60 mL and 250 mL
const acid60 = (o.rows.find(r => r.alt === "ALT-RP-0003") || {}).mg;
const acid250 = (o2.rows.find(r => r.alt === "ALT-RP-0003") || {}).mg;
A(acid60 === acid250, "taste acid is a fixed corpus dose, not %-scaled (" + acid60 + " vs " + acid250 + ")");

// Over-target warns instead of truncating.
o = EF.build("Powder", { actives: [{ name: "A", alt: "ALT-A", mg: 9000 }], targetServingMg: 8000 });
A(o.warnings.some(w => /exceed/.test(w)), "powder over-target → warns");
A(!o.rows.some(r => r.source === "computed-balance"), "powder over-target → no negative balance row");

// No target → scaffold + warning, no balance row (never guesses the fill).
o = EF.build("Powder", { actives: [{ name: "A", alt: "ALT-A", mg: 3000 }] });
A(o.warnings.some(w => /serving weight/i.test(w)), "powder no-target → warns to set serving weight");
A(!o.rows.some(r => r.source === "computed-balance"), "powder no-target → no balance row (no guess)");
A(o.rows.some(r => r.source === "enova-standard"), "powder no-target → still scaffolds the system");

// skipIfActive: customer already dosed citric acid → engine does not re-add it.
o = EF.build("Powder", { actives: [{ name: "Citric", alt: "ALT-RP-0003", mg: 500 }, { name: "X", alt: "ALT-X", mg: 2000 }], targetServingMg: 8000 });
A(o.rows.filter(r => r.alt === "ALT-RP-0003").length === 1, "citric dosed as active is not duplicated by the system");

// every added system row is flagged confirm (nothing auto-final)
o = EF.build("Stickpacks", { actives: [{ name: "A", alt: "ALT-A", mg: 700 }], targetServingMg: 4500 });
A(o.rows.filter(r => r.source === "enova-standard").every(r => r.confirm === true), "every taste/system slot is flagged confirm");

console.log("\n" + (fail === 0 ? "POWDER / STICKPACK / LIQUID FORMULATOR CHECKS PASSED" : fail + " FAILED"));
process.exit(fail ? 1 : 0);
