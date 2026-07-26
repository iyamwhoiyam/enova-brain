const fs = require("fs");
const XLSX = require("xlsx");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");

// slice out: MISYS_CODE_CATEGORY, misysCategory, misysNormCost, parseMisysWorkbook
function sliceFrom(anchor, endAnchor) {
  const s = html.indexOf(anchor);
  const e = html.indexOf(endAnchor, s);
  return html.slice(s, e);
}
const src = sliceFrom("const MISYS_CODE_CATEGORY", "// Reassign the live inventory");

// current snapshot -> INV_IX for the diff
const snap = JSON.parse(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const INV_IX = Object.fromEntries(snap.map(i => [i.n, i]));

// eval the slice with window.XLSX + INV_IX in scope
const factory = new Function("window", "INV_IX", src + "\n;return { parseMisysWorkbook, misysNormCost, misysCategory };");
const { parseMisysWorkbook, misysNormCost, misysCategory } = factory({ XLSX }, INV_IX);

const MISYS_FIXTURE = process.env.MISYS_FIXTURE || "/root/.claude/uploads/efc49f21-89af-55a6-99a7-80c24f9f07bc/e99050f0-MIITEM002_Item_Valuation_20260630.xlsx.xlsx";
if (!require("fs").existsSync(MISYS_FIXTURE)) { console.log("SKIP \u2014 MISys fixture not present (CI without the proprietary export)"); process.exit(0); }
const wb = XLSX.readFile(MISYS_FIXTURE);
const res = parseMisysWorkbook(wb, {});
const s = res.stats;
console.log("=== parseMisysWorkbook (default: status0, type0) ===");
console.log("total:", s.total, "| costed:", s.costed, "| zero-cost:", s.zero, "| junk:", s.junk);
console.log("added(new):", s.added, "| cost-changed:", s.changed, "| removed(missing from export):", s.removed);
console.log("top categories:", Object.entries(s.byCat).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x.join(":")).join("  "));

// spot-check normalization + category on known items
const find = n => res.items.find(x => x.n === n);
console.log("\nspot checks:");
console.log("  misysNormCost(25.62,'kg') =", misysNormCost(25.62, "kg"), "(expect 0.02562)");
console.log("  misysNormCost(0.021,'gm') =", misysNormCost(0.021, "gm"), "(expect 0.021)");
console.log("  misysCategory('ALT-RP-0001') =", misysCategory("ALT-RP-0001"), "| ALT-BT-0001 =", misysCategory("ALT-BT-0001"));
const bt = find("ALT-BT-0001"); console.log("  ALT-BT-0001:", bt && JSON.stringify({c:bt.c,u:bt.u,q:bt.q,g:bt.g}));

let fail = 0; const A = (c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };
A(s.total >= 4400 && s.total <= 4700, "total ~4525, got " + s.total);
A(s.zero > 1500, "zero-cost items present (never invented), got " + s.zero);
A(Math.abs(misysNormCost(25.62,"kg") - 0.02562) < 1e-9, "kg normalized to $/g");
A(misysNormCost(0.021,"gm") === 0.021, "gm stays $/g");
A(misysCategory("ALT-RP-0009") === "Raw Ingredient / Powder", "RP category");
A(misysCategory("ALT-CA-0001") === "Cap / Closure", "CA category");
A(bt && bt.c === "Bottle / Jar", "bottle categorized");
A(bt && bt.u > 0 && bt.q >= 0, "bottle has cost + on-hand");
A(s.added > 2000, "many new items added, got " + s.added);
A(res.items.every(x => x.u >= 0), "no negative costs");
// kg fix: an item priced per kg should now be $/g (small), not $/kg
const kgItem = res.items.find(x => x.uom === "kg" && x.u > 0);
A(kgItem ? kgItem.u < 10 : true, "kg item normalized to per-gram (small $), got " + (kgItem && kgItem.u));

// includeFinished should add items
const res2 = parseMisysWorkbook(wb, { includeFinished: true });
A(res2.stats.total > s.total, "includeFinished adds items: " + res2.stats.total + " > " + s.total);
console.log("\nincludeFinished total:", res2.stats.total, "(+" + (res2.stats.total - s.total) + ")");

console.log("\n" + (fail === 0 ? "ALL ASSERTIONS PASSED" : fail + " FAILED"));
process.exit(fail === 0 ? 0 : 1);
