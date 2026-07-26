// End-to-end browser proof of the new form generators: in a REAL browser, create a powder
// formulation, paste a customer request, Extract (offline) + Apply, set the serving weight, click
// "Build Full Formula", and verify the Enova-standard system + the maltodextrin balance row appear
// in the editable grid — with no page errors. Screenshots for eyes-on review.
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const { chromium } = require(NG + "/playwright");

const POWDER_REQUEST = `Product Form: Powder
Servings per unit: 30
Serving size: 1 scoop
Ingredients:
Creatine Monohydrate 5000mg
L-Citrulline 3000mg
Beta-Alanine 2000mg
Flavor: Fruit Punch
Sweetener: natural, sugar-free`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 2400 } });
  const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + (e.message || e)));
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });

  // In-page: the shipped engine is loaded and builds an exact powder blend.
  const eng = await p.evaluate(() => {
    const EF = window.EnovaFormulator; if (!EF) return { ok: false };
    const o = EF.build("Powder", { actives: [{ name: "A", alt: "ALT-A", mg: 3000 }], targetServingMg: 8000 });
    return { ok: true, version: EF.VERSION, total: o.rows.reduce((s, r) => s + r.mg, 0), rows: o.rows.length,
      balance: (o.rows.find(r => r.source === "computed-balance") || {}).alt };
  });

  // Drive the UI: new formulation → intake → Apply → set weight → Build Full Formula.
  await p.click('.app-nav-item:has-text("Formulation")'); await p.waitForTimeout(300);
  await p.click('button:has-text("+ New Formulation")'); await p.waitForTimeout(400);
  await p.click('button:has-text("Describe Product")'); await p.waitForTimeout(200);
  await p.fill('textarea', POWDER_REQUEST); await p.waitForTimeout(150);
  await p.click('button:has-text("Extract")'); await p.waitForTimeout(700);
  await p.click('button:has-text("Apply to Formulation")'); await p.waitForTimeout(800);

  const dosage = await p.$eval('select', el => el.value).catch(() => "(no select)");
  const rowsBefore = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  // Set the serving weight (the new field, placeholder "e.g. 4500"). 13 g scoop leaves room
  // for the ~10 g of actives + system so the bulking-carrier balance computes.
  const wt = await p.$('input[placeholder="e.g. 4500"]');
  if (wt) { await wt.fill('13000'); await p.waitForTimeout(250); }

  await p.click('button:has-text("Build Full Formula")'); await p.waitForTimeout(1000);

  // The grid shows MISys SKU CODES (not ingredient names), so assert on the house-standard ALT
  // codes the engine adds — including the maltodextrin balance row (ALT-RP-1578).
  const grid = await p.evaluate(() => [...document.querySelectorAll('tbody tr')].map(tr => tr.innerText.replace(/\s+/g, ' ')).join(" | "));
  const rowsAfter = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  const sysCodes = ['ALT-RP-0387', 'ALT-RP-0467', 'ALT-RP-0738', 'ALT-RP-2230', 'ALT-RP-0003'];
  const sysPresent = sysCodes.filter(c => grid.includes(c));
  const hasSystem = sysPresent.length >= 4;
  const hasCarrier = grid.includes('ALT-RP-1578');   // maltodextrin balance row

  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/forms-powder-built.png", fullPage: true });

  console.log("in-page engine:", JSON.stringify(eng));
  console.log("resolved Dosage Form:", dosage);
  console.log("weight field found:", !!wt);
  console.log("grid rows before Build:", rowsBefore, "→ after:", rowsAfter);
  console.log("system SKUs present after Build:", sysPresent.join(",") || "NONE");
  console.log("bulking-carrier balance (ALT-RP-1578) present:", hasCarrier);
  console.log("pageerrors:", errs.length ? errs.join("; ") : "none");

  const ok = eng.ok && Math.abs(eng.total - 8000) < 0.5 && /powder/i.test(dosage) && !!wt && hasSystem && hasCarrier && rowsAfter > rowsBefore && errs.length === 0;
  console.log(ok ? "\nPOWDER BROWSER DRIVE PASSED" : "\nDRIVE INCOMPLETE — see values above");
  await b.close();
  process.exit(ok ? 0 : 1);
})();
