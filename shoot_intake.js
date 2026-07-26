// End-to-end proof of the intake fix: in a real browser, create a formulation, paste the EXACT
// customer request, Extract (offline), Apply, and screenshot — verifying the gummy path fires
// (Dosage Form = Gummies - Retail, gummy base panel present) instead of defaulting to Capsules.
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const { chromium } = require(NG + "/playwright");

const REQUEST = `Product Form: Gummy
Servings per unit: 30
Serving size: 2
Flavor: No artificial flavor-apple flavor
Color: no artificial color
Ingredients: ACV 1000mg
Sugar-free (0 g sugar)
Pectin-based (vegan preferred)
Non-stick coating to help prevent gummies from sticking together, especially during warmer weather
All-natural, clean-label formulation
No artificial colors or flavors
Great taste and texture
Client supplied materials: no
Packaging: Customer Choice, 250cc clear pet / white ribbed lid
Competitive bids: no
Competitive product price: no`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 2200 } });
  const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + (e.message||e)));
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });

  await p.click('.app-nav-item:has-text("Formulation")'); await p.waitForTimeout(300);
  await p.click('button:has-text("+ New Formulation")'); await p.waitForTimeout(400);
  await p.click('button:has-text("Describe Product")'); await p.waitForTimeout(200);
  await p.fill('textarea', REQUEST); await p.waitForTimeout(150);
  await p.click('button:has-text("Extract")'); await p.waitForTimeout(700);
  await p.click('button:has-text("Apply to Formulation")'); await p.waitForTimeout(800);

  // Read back the resolved setup + whether the gummy base panel rendered.
  const dosage = await p.$eval('select', el => el.value).catch(() => "(no select)");
  const bodyTxt = await p.evaluate(() => document.body.innerText);
  const hasGummyBase = /gummy base|sugar[- ]?free base|pectin|master ?coat|base \/ process|gummy type/i.test(bodyTxt);
  const perGummy = /per gummy|\/ ?gummy|gummy quantity|cogs\/gummy/i.test(bodyTxt);

  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/intake-gummy-result.png", fullPage: true });
  console.log("resolved Dosage Form select value:", dosage);
  console.log("gummy base/coating present:", hasGummyBase, "| per-gummy labels:", perGummy);
  console.log("pageerrors:", errs.length ? errs.join("; ") : "none");
  await b.close();
})();
