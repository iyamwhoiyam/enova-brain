// BATCH-TOTAL GUARD — locks the P26247 fix (Hot Flash Tablets, JAG, bulk 6,000).
// The customer sheet listed the RUN's totals (480,000 mg sage = 480 g for 6,000 tablets) plus a
// per-tablet carrier (463 mg malto) and a "Total 800" weight line. The extractor imported all of it
// per-tablet → $771.97/tablet. This locks the three-part fix:
//   1. localExtractF: a "Total ___" line becomes statedTotalMg metadata, never an ingredient.
//   2. batchTotalInterpret: impossible rows ÷ batch qty; plausible rows untouched; sums cross-check.
//   3. validateProject: a still-impossible blend mass is a RED readiness error before approval.
const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC || require("path").join(__dirname, "Enova_Brain_Studio_2.html")), "utf8");
function sliceFn(name){
  const start = html.indexOf("function "+name+"(");
  let i = html.indexOf("{", start), depth = 0, end = -1;
  for (; i < html.length; i++) { if (html[i]==="{") depth++; else if (html[i]==="}"){ depth--; if (depth===0){ end=i+1; break; } } }
  return html.slice(start, end);
}
const src = sliceFn("cleanIngName")+"\n"+sliceFn("localExtractF")+"\n"+sliceFn("formMassBounds")+"\n"+sliceFn("batchTotalInterpret")+"\n"+sliceFn("validateProject");
const ctx = new Function(src+"\n;return {localExtractF, formMassBounds, batchTotalInterpret, validateProject};")();
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (a,b,t) => Math.abs(a-b) <= (t==null?1e-6:t);

// ── 1. "Total" line → metadata, not an ingredient ─────────────────────────────
const ext = ctx.localExtractF(`Hot Flash Tablets — bulk tablets
Sibelus Sage Extract 480000 mg
Black Cohosh P.E. 240000 mg
Affron Saffron 84000 mg
Organic Tapioca Maltodextrin 463 mg
Total 800 mg`);
A(ext.statedTotalMg === 800, "'Total 800 mg' captured as statedTotalMg, got " + ext.statedTotalMg);
A(!ext.ingredients.some(i => /^total/i.test(i.name)), "no 'Total' ingredient row imported");
A(ext.ingredients.length === 4, "4 real ingredients kept, got " + ext.ingredients.length);

// ── 2. interpreter: impossible rows ÷ 6,000; the per-tablet carrier untouched ─
const rows = [
  { importedName:"Sage",   inputMg:480000 },
  { importedName:"Cohosh", inputMg:240000 },
  { importedName:"Affron", inputMg:84000, dosedMg:87360 },
  { importedName:"Malto",  inputMg:463 },            // already per-tablet — must NOT be divided
];
const bt = ctx.batchTotalInterpret(rows, "Tablets", 1, 6000);
A(bt.converted.length === 3, "3 impossible rows converted, got " + bt.converted.length);
A(near(rows[0].inputMg, 80), "sage 480,000 → 80 mg/tablet, got " + rows[0].inputMg);
A(near(rows[2].inputMg, 14) && near(rows[2].dosedMg, 14.56), "affron → 14 mg claim / 14.56 dosed, got " + rows[2].inputMg + "/" + rows[2].dosedMg);
A(near(rows[3].inputMg, 463), "per-tablet malto (463) left untouched, got " + rows[3].inputMg);
A(rows[0].batchConverted === true && rows[3].batchConverted === undefined, "conversion flagged per row");

// no batch qty → flag, never divide
const rows2 = [{ importedName:"X", inputMg:480000 }];
const bt2 = ctx.batchTotalInterpret(rows2, "Tablets", 1, 0);
A(bt2.flagged.length === 1 && near(rows2[0].inputMg, 480000), "no batch qty → flagged, untouched");
// plausible formulas never trip (regression: RadiantGlow capsule 608mg/serv)
const rows3 = [{ inputMg:500 }, { inputMg:108.75 }];
const bt3 = ctx.batchTotalInterpret(rows3, "Capsules", 2, 5000);
A(bt3.converted.length === 0 && bt3.flagged.length === 0, "plausible capsule formula untouched");

// ── 3. readiness gate: impossible mass = RED error; corrected mass = clean ────
const badP  = { pn:"P26247", dosageForm:"Tablets", servingSize:1, servingsPerUnit:1, batchUnits:6000,
  ingredients:[{ inputMg:480000, item:{n:"X", u:0.5} }] };
const vBad = ctx.validateProject(badP);
A(vBad.errors.some(e => /physically impossible/i.test(e)), "impossible tablet mass is a RED readiness error: " + JSON.stringify(vBad.errors));
const okP = { ...badP, ingredients:[{ inputMg:80, item:{n:"X", u:0.5} }, { inputMg:463, item:{n:"Y", u:0.003} }] };
A(!ctx.validateProject(okP).errors.some(e => /physically impossible/i.test(e)), "corrected 800mg tablet passes the gate");

console.log(fail === 0 ? "BATCH-TOTAL GUARD PASSED (P26247 scenario: detect, convert per-row, cross-check, red-flag)" : fail + " FAILED");
process.exit(fail ? 1 : 0);
