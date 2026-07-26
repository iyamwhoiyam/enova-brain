const fs = require("fs");
// The gummy base now lives in the kernel (EnovaBrain.gummyBase, §43). Test it directly against the
// real MISys inventory + the P26206 workbook per-gummy values (the logic's home moved out of the app).
const B = require((process.env.ENOVA_KERNEL||require("path").join(__dirname,"enova_brain.js")));

// INV_IX from the MISys export (normalized $/g like the app importer)
const XLSX = require("xlsx");
const MISYS_FIXTURE = process.env.MISYS_FIXTURE || "/root/.claude/uploads/efc49f21-89af-55a6-99a7-80c24f9f07bc/e99050f0-MIITEM002_Item_Valuation_20260630.xlsx.xlsx";
if (!require("fs").existsSync(MISYS_FIXTURE)) { console.log("SKIP \u2014 MISys fixture not present (CI without the proprietary export)"); process.exit(0); }
const wb = XLSX.readFile(MISYS_FIXTURE);
const rows = XLSX.utils.sheet_to_json(wb.Sheets["MIITEM"], { header: 1 });
const H = {}; rows[0].forEach((n, i) => H[n] = i);
const INV_IX = {};
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]; const id = String(r[H.itemId] == null ? "" : r[H.itemId]).trim();
  if (!id) continue;
  const uom = String(r[H.uOfM] || "").toLowerCase(); let u = Number(r[H.cAvg]) || 0;
  if (uom === "kg") u = u / 1000;
  INV_IX[id] = { n: id, u };
}
const FORM_CFG = { "Gummies - Retail": { gummy: true, bulk: false }, "Gummies - Bulk": { gummy: true, bulk: true } };
const CONTAINER_TYPES = {};

// Adapter over the kernel — same call shape the app helpers had (bulk passed explicitly here).
const M = {
  gummyActivesMgPerGummy: (p) => B.gummyActivesMgPerGummy(p),
  gummyBaseRows: (p, o) => B.gummyBase(p, { invIx: INV_IX, bulk: !!(o && o.bulk), activesMgPerGummy: o && o.activesMgPerGummy }).rows,
  gummyBaseCostPerGummy: (p, o) => B.gummyBase(p, { invIx: INV_IX, bulk: !!(o && o.bulk) }).costPerPiece,
  gummyBaseNames: (p, o) => B.gummyBase(p, { invIx: INV_IX, bulk: !!(o && o.bulk) }).rows.filter((r) => !r.nc).map((r) => r.name),
};

// P26206 SF Berberine Gummies: 3000mg gummy, serving=2, 3 actives
const proj = {
  dosageForm: "Gummies - Retail", gummyType: "sugarFree", gummyWt: 3000, servingSize: 2,
  containerType: "Bottle", isBulk: false, baseItems: {},
  ingredients: [
    { item: {}, inputMg: 500, potencyPct: 97 },   // Berberine HCl 97%
    { item: {}, inputMg: 200, potencyPct: 100 },  // Cinnamon 4:1
    { item: {}, inputMg: 0.2, potencyPct: 12 },   // Chromium Picolinate 12%
  ],
};

const actMg = M.gummyActivesMgPerGummy(proj);
console.log("actives mg/gummy:", actMg.toFixed(3), "(expect ~358.56)");
const base = M.gummyBaseRows(proj, { bulk: false });
console.log("\nbase rows (mg/gummy):");
base.forEach(r => console.log(`  ${r.name.padEnd(34)} ${r.mgG.toFixed(2).padStart(9)}  $${r.cost.toFixed(6)}  ${r.fresh ? "["+r.rm+"]" : (r.rm||"")}`));
const totalBaseMg = base.reduce((s, r) => s + r.mgG, 0);
console.log("\ntotal base mg:", totalBaseMg.toFixed(2), "+ actives", actMg.toFixed(2), "=", (totalBaseMg + actMg).toFixed(2), "(expect 3000)");
console.log("base cost/gummy:", "$" + M.gummyBaseCostPerGummy(proj, { bulk: false }).toFixed(6));
console.log("Other Ingredients:", M.gummyBaseNames(proj, { bulk: false }).join(", "));

// assertions vs workbook MASTER FORMULA per-gummy (col J)
const get = n => { const r = base.find(x => x.name.includes(n)); return r ? r.mgG : null; };
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
A(Math.abs(actMg - 358.56) < 0.5, "actives 358.56, got " + actMg.toFixed(2));
A(Math.abs(get("Sorbitol") - 1350) < 3, "Sorbitol 1350, got " + get("Sorbitol"));
A(Math.abs(get("Maltitol") - 615) < 3, "Maltitol 615, got " + get("Maltitol"));
A(Math.abs(get("Pectin") - 90) < 0.5, "Pectin 90, got " + get("Pectin"));
A(Math.abs(get("Water") - 365) < 1, "Water 365, got " + get("Water"));
A(Math.abs(get("Citric") - 21) < 0.5, "Citric 21, got " + get("Citric"));
A(Math.abs(get("Glycerin") - 60) < 0.5, "Glycerin 60, got " + get("Glycerin"));
A(Math.abs(get("Calcium Citrate") - 18) < 0.5, "Calcium Citrate 18, got " + get("Calcium Citrate"));
A(Math.abs(get("Mastercoat") - 15) < 0.5, "Mastercoat 15, got " + get("Mastercoat"));
A(Math.abs((totalBaseMg + actMg) - 3000) < 1, "total = 3000, got " + (totalBaseMg + actMg).toFixed(2));
A(base.length === 14, "14 base rows (retail), got " + base.length);

// bulk pack-out drops the coating (Mastercoat)
const baseBulk = M.gummyBaseRows({ ...proj, isBulk: true }, { bulk: true });
A(!baseBulk.some(r => r.coating), "bulk drops coating");
A(baseBulk.length === 13, "13 base rows (bulk, no coating), got " + baseBulk.length);

// sugar variant balances to gummyWt too
const sugar = M.gummyBaseRows({ ...proj, gummyType: "sugar", gummyWt: 4500 }, { bulk: false });
const sugarTotal = sugar.reduce((s, r) => s + r.mgG, 0) + M.gummyActivesMgPerGummy({ ...proj });
A(Math.abs(sugarTotal - 4500) < 1, "sugar total 4500, got " + sugarTotal.toFixed(2));

console.log("\n" + (fail === 0 ? "ALL ASSERTIONS PASSED" : fail + " FAILED"));
process.exit(fail === 0 ? 0 : 1);
