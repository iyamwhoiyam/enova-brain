// ─────────────────────────────────────────────────────────────────────────────
// EnovaBrain.label() — Supplement Facts + FDA compliance engine.
// A supplement panel is FORMULA-DRIVEN (not database-driven): declared actives at their per-serving
// amounts + a %DV for the ones with an established FDA Daily Value. This locks the DV table (2016
// final rule, 21 CFR 101.9(c)), the nutrient-synonym mapping, the %DV math, allergen detection, and
// the reviewLabel() compliance invariants. Amount/unit of mapped micronutrients is a DRAFT the
// reviewer confirms (Enova's formula stores a single mg/serving figure); the engine flags it.
// ─────────────────────────────────────────────────────────────────────────────
const B = require((process.env.ENOVA_KERNEL||require("path").join(__dirname,"enova_brain.js")));
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (a, b, t) => Math.abs(a - b) <= (t == null ? 1e-9 : t);

// ── 1. FDA Daily Value table (verified against FDA's published 2016-rule values) ──
(() => {
  const DV = B.DAILY_VALUES;
  A(DV["Vitamin C"].dv === 90 && DV["Vitamin C"].unit === "mg", "Vitamin C DV 90 mg");
  A(DV["Vitamin D"].dv === 20 && DV["Vitamin D"].unit === "mcg", "Vitamin D DV 20 mcg");
  A(DV["Calcium"].dv === 1300, "Calcium DV 1300 mg (2016 rule)");
  A(DV["Magnesium"].dv === 420, "Magnesium DV 420 mg");
  A(DV["Zinc"].dv === 11, "Zinc DV 11 mg");
  A(DV["Folate"].dv === 400 && /DFE/.test(DV["Folate"].unit), "Folate DV 400 mcg DFE");
  A(DV["Vitamin A"].dv === 900 && /RAE/.test(DV["Vitamin A"].unit), "Vitamin A DV 900 mcg RAE");
  A(DV["Vitamin E"].dv === 15, "Vitamin E DV 15 mg");
  A(DV["Niacin"].dv === 16 && /NE/.test(DV["Niacin"].unit), "Niacin DV 16 mg NE");
  A(DV["Sodium"].dv === 2300 && DV["Potassium"].dv === 4700, "Sodium 2300 / Potassium 4700");
  A(Object.keys(DV).length >= 34, "full DV table present (" + Object.keys(DV).length + " nutrients)");
})();

// ── 2. nutrient-synonym mapping (supplement forms → canonical DV nutrient) ──
(() => {
  const M = (n) => B.dvForNutrient(n);
  A(M("Vitamin C, Ascorbic acid") === "Vitamin C", "ascorbic acid → Vitamin C");
  A(M("Sodium Ascorbate") === "Vitamin C", "sodium ascorbate → Vitamin C (vitamin wins over mineral)");
  A(M("Vitamin D3 (Cholecalciferol)") === "Vitamin D", "cholecalciferol → Vitamin D");
  A(M("Quatrefolic (6S-5-MTHF)") === "Folate", "5-MTHF → Folate");
  A(M("Methylcobalamin") === "Vitamin B12", "methylcobalamin → Vitamin B12");
  A(M("Zinc Gluconate (14% Zn)") === "Zinc", "zinc gluconate → Zinc");
  A(M("Magnesium Glycinate") === "Magnesium", "magnesium glycinate → Magnesium");
  A(M("Chromium Picolinate") === "Chromium", "chromium picolinate → Chromium");
  A(M("Pyridoxine HCl") === "Vitamin B6", "pyridoxine → Vitamin B6");
  A(M("Potassium Iodide") === "Iodine", "potassium iodide → Iodine (iodine wins)");
  A(M("N-Acetyl L-Cysteine") === null, "NAC has no DV → null");
  A(M("Inositol") === null, "inositol has no DV → null");
  A(M("Ashwagandha Extract") === null, "botanical → null");
})();

// ── 3. panel build + %DV math (the common, correct case) ──
(() => {
  const proj = { product: "Test", dosageForm: "Capsules", servingSize: 2, servingsPerUnit: 30,
    ingredients: [
      { name: "Vitamin C, Ascorbic acid", inputMg: 45 },   // 45/90 = 50%
      { name: "Zinc Gluconate (14% Zn)", inputMg: 5.5 },    // 5.5/11 = 50%
      { name: "Magnesium Glycinate", inputMg: 105 },        // 105/420 = 25%
      { name: "Ashwagandha Extract", inputMg: 600 },        // no DV → dagger
    ] };
  const m = B.labelModel(proj, {});
  A(m.heading === "Supplement Facts", "heading = Supplement Facts");
  A(m.servingSize === "2 Capsules", "serving size text = '2 Capsules', got " + m.servingSize);
  A(m.servingsPerContainer === 30, "servings/container = 30");
  const byN = (n) => m.rows.find((r) => r.nutrient === n);
  A(near(byN("Vitamin C").dvPct, 50), "Vitamin C 45mg → 50% DV, got " + byN("Vitamin C").dvPct);
  A(near(byN("Zinc").dvPct, 50), "Zinc 5.5mg → 50% DV");
  A(near(byN("Magnesium").dvPct, 25), "Magnesium 105mg → 25% DV");
  const ash = m.rows.find((r) => /Ashwagandha/.test(r.name));
  A(ash.dagger === true && ash.dvPct === null, "Ashwagandha → dagger, no %DV");
  A(m.rows.filter((r) => r.nutrient).every((r) => r.confirm), "mapped nutrients flagged for reviewer confirm");
  A(m.footnotes.some((f) => /Daily Value.*not established/.test(f)), "dagger footnote present");
})();

// ── 4. serving-size text per dose form ──
(() => {
  const st = (form, ss, extra) => B.labelModel(Object.assign({ dosageForm: form, servingSize: ss, ingredients: [] }, extra || {}), {}).servingSize;
  A(st("Gummies", 2) === "2 Gummies", "gummy serving text");
  A(st("Capsules", 1) === "1 Capsule", "singular capsule");
  A(st("Stickpacks", 1) === "1 Stick Pack", "stick pack serving text");
  A(st("Liquid", 30) === "30 mL", "liquid serving text");
  A(/Scoop/.test(st("Powder", 1, { servWtMg: 8000 })) && /8\.0 g/.test(st("Powder", 1, { servWtMg: 8000 })), "powder scoop + grams");
})();

// ── 5. FALCPA allergen detection (from actives + other ingredients) ──
(() => {
  const proj = { dosageForm: "Powder", servingSize: 1, servingsPerUnit: 30,
    ingredients: [{ name: "Whey Protein Concentrate", inputMg: 25000 }, { name: "Creatine Monohydrate", inputMg: 5000 }] };
  const m = B.labelModel(proj, { otherIngredients: ["Natural Flavor", "Soy Lecithin", "Sucralose"] });
  A(m.contains.includes("Milk"), "whey → Contains: Milk");
  A(m.contains.includes("Soy"), "soy lecithin → Contains: Soy");
  A(!m.contains.includes("Peanuts"), "no false peanut allergen");
})();

// ── 6. reviewLabel — clean panel passes; injected faults trip the right codes ──
(() => {
  const clean = { product: "P", dosageForm: "Capsules", servingSize: 2, servingsPerUnit: 30,
    ingredients: [{ name: "Vitamin C, Ascorbic acid", inputMg: 90 }, { name: "Ashwagandha", inputMg: 300 }] };
  const r = B.label(clean, {});
  A(r.review.ok, "clean panel reviews ok");
  A(r.review.errors.length === 0, "clean panel has no blocking errors, got " + JSON.stringify(r.review.errors.map((e) => e.code)));

  // FACTS_TIE: panel with fewer rows than dosed actives
  const m2 = B.labelModel(clean, {}); m2.rows = m2.rows.slice(0, 1);
  A(B.reviewLabel(m2, clean, {}).errors.some((e) => e.code === "LABEL_FACTS_TIE"), "dropping an active trips LABEL_FACTS_TIE");

  // SERVING_TIE: servings mismatch
  const m3 = B.labelModel(clean, {}); m3.servingsPerContainer = 99;
  A(B.reviewLabel(m3, clean, {}).errors.some((e) => e.code === "LABEL_SERVING_TIE"), "servings mismatch trips LABEL_SERVING_TIE");

  // UNITS: an implausible %DV (unit error) → warning
  const bad = { dosageForm: "Capsules", servingSize: 1, servingsPerUnit: 30, ingredients: [{ name: "Vitamin C", inputMg: 5000 }] };
  A(B.label(bad, {}).review.warnings.some((w) => w.code === "LABEL_UNITS"), "Vitamin C 5000mg (>1000%DV) trips LABEL_UNITS warn");
})();

// ── 7. %DV rounding rule ──
(() => {
  A(B.roundDVpct(49.6) === 50, "49.6% → 50%");
  A(B.roundDVpct(0.3) === 0.3, "sub-1% keeps a decimal");
  A(B.roundDVpct(0) === 0, "0 → 0");
})();

console.log(fail === 0 ? "ENOVA BRAIN LABEL CHECKS PASSED" : fail + " FAILED");
process.exit(fail ? 1 : 0);
