const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");

// slice out cleanIngName + localExtractF (localExtractF now calls cleanIngName) by brace-matching
function sliceFn(name){
  const start = html.indexOf("function "+name+"(");
  let i = html.indexOf("{", start), depth = 0, end = -1;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return html.slice(start, end);
}
const localExtractF = new Function(
  sliceFn("cleanIngName") + "\n" + sliceFn("localExtractF") + "\n;return localExtractF;")();

function show(label, out) {
  console.log("\n===== " + label + " =====");
  console.log("form:", out.dosageForm, "| bulk:", out.isBulk, "| gummyType:", out.gummyType, "| gummyWt:", out.gummyWeightMg);
  console.log("customer:", out.customerName, "| product:", out.productName);
  console.log("servingSize:", out.servingSize, "| servingsPerUnit:", out.servingsPerUnit, "| batchQty:", out.batchQuantity);
  console.log("tierPricing:", JSON.stringify(out.tierPricing));
  console.log("ingredients (" + out.ingredients.length + "):");
  out.ingredients.forEach(r => console.log("   - " + JSON.stringify(r)));
  if (out.formulationNotes) console.log("notes:", out.formulationNotes);
}

// 1) The exact screenshot paste (dotted leaders, % assay before mg, OCR quirks)
const screenshot = `Vitamin B6 (as Pyridoxine Hydrochloride) 83%............6mg
Magnesium Citrate 30%................................160mg
Zinc (L-Monomethionine and Zinc Aspartate) 20% TM.......6mg
- I tyrosine.......................................1475 mg`;
show("SCREENSHOT PASTE", localExtractF(screenshot));

// 2) Seed-style stickpack request (dash separators, N/A, g units, gummy-base words that must NOT be skipped here)
const stick = `Project Description: L-Theanine - 400 mg
Rhodiola Rosea Extract (3% rosavins) - 150 mg
KSM-66(R) Ashwagandha - 300 mg
Magnesium (as Glycinate) - 100 mg
Matcha Green Tea Powder (Organic) - N/A
Organic Beet Root (for color) - 50 mg
Citric Acid (for tartness) - 60 mg
Stevia Leaf Extract - 20 mg
Inulin (prebiotic fiber - filler) - 3 g

Total weight per stick - 4.5 g
Powder sachet at 5g /stickpack, 20 sticks per box
Customer Name: AVN GoRelax
Dosage Form (per Salesforce): Stick Pack`;
show("STICKPACK REQUEST", localExtractF(stick));

// 3) Gummy request — base ingredients MUST be skipped; IU + CFU flagged
const gummy = `Product: Sleep Gummy
Customer: Acme Wellness
60 count bottle, 2 gummies per serving, sugar-free
Melatonin ..... 5 mg
Vitamin D3 ..... 1000 IU
L-Theanine ..... 200 mg
Probiotic Blend ..... 5 billion CFU
Pectin ..... 900 mg
Citric Acid ..... 40 mg
Natural Flavor ..... 15 mg
Total weight per gummy - 4.5 g`;
show("GUMMY REQUEST", localExtractF(gummy));

// 4) empty / non-ingredient text
show("EMPTY", localExtractF("We are looking for a preworkout. Please advise on flavors."));

// ---- assertions ----
let fail = 0;
const A = (cond, msg) => { if (!cond) { console.log("ASSERT FAIL:", msg); fail++; } };
const s1 = localExtractF(screenshot);
A(s1.ingredients.length === 4, "screenshot -> 4 ingredients, got " + s1.ingredients.length);
A(s1.ingredients[0].mgPerServing === 6, "B6 = 6 mg");
A(s1.ingredients[1].mgPerServing === 160, "Mg citrate = 160 mg");
A(s1.ingredients[3].mgPerServing === 1475, "tyrosine = 1475 mg");
A(/Pyridoxine/i.test(s1.ingredients[0].name), "B6 name kept the (as Pyridoxine...) qualifier");
A(!/%/.test(s1.ingredients[0].name), "no % left in the B6 name");
A(/83%/.test(s1.formulationNotes || ""), "83% surfaced as a potency note");
A(s1.tierPricing.length === 0, "no prices parsed");

const s2 = localExtractF(stick);
A(s2.dosageForm === "Stickpacks", "stick form, got " + s2.dosageForm);
A(s2.ingredients.some(r => /theanine/i.test(r.name) && r.mgPerServing === 400), "L-Theanine 400");
A(s2.ingredients.some(r => /inulin/i.test(r.name) && r.mgPerServing === 3000), "Inulin 3 g -> 3000 mg");
A(s2.ingredients.some(r => /matcha/i.test(r.name) && r.rawUnitAsWritten === "N/A"), "Matcha N/A captured");
A(s2.ingredients.some(r => /citric acid/i.test(r.name)), "citric acid KEPT (stickpack, not gummy)");
A(/AVN GoRelax/i.test(s2.customerName || ""), "customer AVN GoRelax");

const s3 = localExtractF(gummy);
A(s3.dosageForm === "Gummies - Retail", "gummy form, got " + s3.dosageForm);
A(s3.gummyType === "sugarFree", "sugar-free detected");
A(!s3.ingredients.some(r => /pectin|citric acid|natural flavor/i.test(r.name)), "gummy base ingredients skipped");
A(s3.ingredients.some(r => /melatonin/i.test(r.name) && r.mgPerServing === 5), "melatonin 5 mg");
A(s3.ingredients.some(r => /d3/i.test(r.name) && r.mgPerServing === 0), "D3 IU -> 0 mg (flagged)");
A(s3.ingredients.some(r => /probiotic/i.test(r.name) && r.mgPerServing === 0), "probiotic CFU -> 0 mg (flagged)");
A(/IU/.test(s3.formulationNotes || ""), "IU note present");
A(s3.servingsPerUnit === 60, "60 count -> servingsPerUnit 60, got " + s3.servingsPerUnit);

const s4 = localExtractF("We are looking for a preworkout. Please advise on flavors.");
A(s4.ingredients.length === 0, "no ingredients invented from vague text, got " + s4.ingredients.length);

console.log("\n" + (fail === 0 ? "ALL ASSERTIONS PASSED" : fail + " ASSERTION(S) FAILED"));
process.exit(fail === 0 ? 0 : 1);
