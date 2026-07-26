const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");

// ---- pull the live seeded inventory the app ships with (already categorized) ----
const INVENTORY = JSON.parse(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
const INV_IX = Object.fromEntries(INVENTORY.map(i => [i.n, i]));
console.log("inventory items:", INVENTORY.length);
const catCount = {};
INVENTORY.forEach(i => { catCount[i.c] = (catCount[i.c] || 0) + 1; });
["Bottle / Jar", "Cap / Closure", "Label", "Desiccant", "Tamper Seal / Shrink Band", "Shipper / Box", "Scoop", "Capsule Shell", "Bag / Pouch (Bulk)"]
  .forEach(c => console.log("  " + c.padEnd(30), catCount[c] || 0));

// The packaging ENGINE now lives in the kernel (EnovaBrain.packaging, §45). Test it directly against
// the real embedded inventory. CONTAINER_TYPES + coerceContainerForForm stay app-side config, so we
// slice those to build the ctx (container + slots + shell flag) the kernel entry expects.
const B = require((process.env.ENOVA_KERNEL||require("path").join(__dirname,"enova_brain.js")));
const cc0 = html.indexOf("const CONTAINER_TYPES = {");
const cc1 = html.indexOf("// ══════════════════ PACKAGING + SHIPPING");   // stop before the delegated adapters
const containerSrc = html.slice(cc0, cc1);       // CONTAINER_TYPES + defaultContainerFor + coerceContainerForForm
const f0 = html.indexOf("const FORM_CFG = {");
const f1 = html.indexOf("const CONTAINER_TYPES = {");
const formCfg = html.slice(f0, f1);
const cfg = new Function(formCfg + "\n" + containerSrc + "\n;return { CONTAINER_TYPES, coerceContainerForForm, defaultContainerFor, FORM_CFG };")();
const M = {
  generatePackaging: (proj, projects) => {
    const container = cfg.coerceContainerForForm(proj);
    const slots = (cfg.CONTAINER_TYPES[container] || cfg.CONTAINER_TYPES["Bottle"]).pkg || [];
    const needsShell = (cfg.FORM_CFG[proj.dosageForm] || {}).shell;
    return B.packaging(proj, { inventory: INVENTORY, invIx: INV_IX, projects: projects || [], container, slots, needsShell });
  },
  pkgCapacityCC: B.pkgCapacityCC, pkgNeckFinish: B.pkgNeckFinish, CONTAINER_TYPES: cfg.CONTAINER_TYPES,
};

function showPkg(label, proj, projects) {
  console.log("\n===== " + label + " =====");
  const g = M.generatePackaging(proj, projects || []);
  console.log(`container: ${g.container} | pieces/unit: ${g.pieces} | target fill: ${Math.round(g.targetCC)}cc | recall: ${g.recallSrc || "none"}`);
  g.slots.forEach(s => {
    const it = g.pkg[s.k], mt = g.meta[s.k];
    if (it) console.log(`  ${s.l.padEnd(18)} ${String(it.n).padEnd(13)} ${(it.d || "").slice(0, 46).padEnd(46)} $${Number(it.u).toFixed(4)}  [${mt.source}: ${mt.reason}]`);
    else    console.log(`  ${s.l.padEnd(18)} (none in stock)`);
  });
  if (g.shell) console.log(`  Capsule Shell      ${String(g.shell.n).padEnd(13)} ${(g.shell.d || "").slice(0, 46)}`);
  return g;
}

let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };

// 1) P26206 — 60ct SF gummy bottle (2/serving × 30 servings = 60 gummies × 3g = 180g → ~250cc)
const gummy = {
  pn: "P26206", dosageForm: "Gummies - Retail", gummyType: "sugarFree", gummyWt: 3000,
  servingSize: 2, servingsPerUnit: 30, isBulk: false, containerType: "Bottle",
  ingredients: [{ item: {}, inputMg: 500 }, { item: {}, inputMg: 200 }],
};
const gp = showPkg("P26206 SF GUMMY (60ct bottle)", gummy);
A(gp.container === "Bottle", "gummy → Bottle container");
A(Math.abs(gp.targetCC - 252) < 30, "gummy target ~252cc, got " + Math.round(gp.targetCC));
A(gp.pkg.container && M.pkgCapacityCC(gp.pkg.container.d) >= gp.targetCC * 0.98, "container holds the fill");
A(gp.pkg.container && M.pkgNeckFinish(gp.pkg.container.d), "container has a neck finish");
if (gp.pkg.container && gp.pkg.closure) {
  A(M.pkgNeckFinish(gp.pkg.closure.d) === M.pkgNeckFinish(gp.pkg.container.d), "closure neck matches container neck");
}
A(!!gp.pkg.label, "label chosen");
A(!!gp.pkg.shipper, "master shipper chosen");
A(!gp.shell, "gummy has no capsule shell");

// 2) Capsules — 60ct "00" bottle
const caps = {
  pn: "P26050", dosageForm: "Capsules", isBulk: false, containerType: "Bottle",
  shellItem: { n: "ALT-CS-0002", d: 'Size "00" White Veggie Capsule' },
  servingSize: 2, servingsPerUnit: 30,
  ingredients: [{ item: {}, inputMg: 400 }, { item: {}, inputMg: 250 }],
};
const cp = showPkg("P26050 CAPSULE (60ct '00' bottle)", caps);
A(cp.container === "Bottle", "capsule → Bottle");
A(cp.pieces === 60, "capsule pieces 60, got " + cp.pieces);
A(cp.pkg.container && M.pkgCapacityCC(cp.pkg.container.d) >= cp.targetCC * 0.98, "capsule container holds 60×00");
A(!!cp.pkg.desiccant, "capsule gets a desiccant");
if (cp.pkg.container && cp.pkg.closure)
  A(M.pkgNeckFinish(cp.pkg.closure.d) === M.pkgNeckFinish(cp.pkg.container.d), "capsule closure neck matches");

// 3) Powder canister — needs a scoop
const powder = {
  pn: "P26052", dosageForm: "Powder", isBulk: false, containerType: "Canister / Tub",
  servingSize: 1, servingsPerUnit: 30,
  ingredients: [{ item: {}, inputMg: 5000 }, { item: {}, inputMg: 3000 }],
};
const pp = showPkg("P26052 POWDER (30-serving canister)", powder);
A(pp.container === "Canister / Tub", "powder → Canister / Tub");
A(pp.slots.some(s => s.k === "scoop"), "powder has a scoop slot");

// 4) Liquid shot bottle — prefer glass/PET
const liquid = {
  pn: "P26058", dosageForm: "Liquid", isBulk: false, containerType: "Bottle",
  servingSize: 30, servingsPerUnit: 1,
  ingredients: [{ item: {}, inputMg: 500 }],
};
const lp = showPkg("P26058 LIQUID SHOT (30mL bottle)", liquid);
A(lp.container === "Bottle", "liquid → Bottle");
A(lp.pkg.container ? M.pkgCapacityCC(lp.pkg.container.d) >= 30 * 0.98 : true, "liquid container ≥30mL");

// 5) RECALL — a prior project with real packaging for the same spec is reused
const prior = {
  pn: "P26100", dosageForm: "Gummies - Retail", gummyType: "sugarFree",
  containerType: "Bottle", unitsPerContainer: 60,
  pkg: {
    container: INV_IX["ALT-BT-0001"] || INVENTORY.find(i => i.c === "Bottle / Jar"),
    closure: INVENTORY.find(i => i.c === "Cap / Closure"),
    label: INVENTORY.find(i => i.c === "Label"),
  },
};
const rp = showPkg("P26206 WITH RECALL (prior P26100 same spec)", gummy, [prior]);
A(rp.recallSrc === "P26100", "recalled from P26100, got " + rp.recallSrc);
A(rp.meta.container && rp.meta.container.source === "recalled", "container marked recalled");

// 6) Stick-pack box — foil + display + master shipper, NEVER a bottle/closure
const stick = { pn: "P262112x", dosageForm: "Stickpacks", isBulk: false, servingSize: 1, servingsPerUnit: 28, unitsPerContainer: 28, ingredients: [{ item: {}, inputMg: 1000 }] };
const sk = showPkg("STICKPACK (28-count box)", stick);
A(sk.container === "Stick-Pack Box", "stickpack → Stick-Pack Box, got " + sk.container);
A(sk.slots.some(s => s.k === "foil"), "stickpack has a foil slot");
A(sk.slots.some(s => s.k === "display"), "stickpack has a display slot");
A(!sk.slots.some(s => s.k === "container" || s.k === "closure"), "stickpack has NO bottle/closure slot");
A(!!sk.pkg.shipper, "stickpack has a master shipper");

// 7) Bulk order — a bulk container (bag), no retail closure/label
const bulk = { pn: "P26xBulk", dosageForm: "Capsules", isBulk: true, servingSize: 2, servingsPerUnit: 30, ingredients: [{ item: {}, inputMg: 400 }] };
const bp = showPkg("BULK CAPSULES", bulk);
A(/Bulk/.test(bp.container), "bulk capsule → a Bulk container, got " + bp.container);
A(!bp.slots.some(s => s.k === "closure"), "bulk order has no retail closure");
A(!!bp.pkg.shipper, "bulk order still has a master shipper");

console.log("\n" + (fail === 0 ? "ALL PACKAGING ASSERTIONS PASSED" : fail + " FAILED"));
process.exit(fail === 0 ? 0 : 1);
