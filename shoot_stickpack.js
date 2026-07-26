// End-to-end proof: (A) a stick-pack formulation auto-generates the correct packaging (foil +
// display box + master shipper — NO bottle/cap/scoop), and (B) the Project Page shows editable
// price cells, a "Go to MFSO" button, and a blank labor tech.
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const { chromium } = require(NG + "/playwright");

const STICK_REQ = `Product Form: Stick Pack
Servings per unit: 28
Serving size: 1
Ingredients:
L-Theanine 200mg
Ashwagandha Extract 300mg
Magnesium Glycinate 150mg
Flavor: Natural Citrus`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 2600 } });
  const errs = []; p.on("pageerror", e => errs.push("pageerror: " + (e.message || e)));
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });

  // ── A) Formulate a stick pack → set stick weight → auto-generate packaging ──
  await p.click('.app-nav-item:has-text("Formulation")'); await p.waitForTimeout(300);
  await p.click('button:has-text("+ New Formulation")'); await p.waitForTimeout(400);
  await p.click('button:has-text("Describe Product")'); await p.waitForTimeout(200);
  await p.fill('textarea', STICK_REQ); await p.waitForTimeout(150);
  await p.click('button:has-text("Extract")'); await p.waitForTimeout(700);
  await p.click('button:has-text("Apply to Formulation")'); await p.waitForTimeout(800);
  const dosage = await p.$eval('select', el => el.value).catch(() => "(no select)");
  const wt = await p.$('input[placeholder="e.g. 4500"]'); if (wt) { await wt.fill('4500'); await p.waitForTimeout(200); }
  await p.click('button:has-text("Auto-Generate Packaging")').catch(()=>{});
  await p.waitForTimeout(300);
  // if a confirm dialog appears, accept it
  const rep = await p.$('button:has-text("Replace")'); if (rep) { await rep.click(); await p.waitForTimeout(400); }
  await p.waitForTimeout(500);

  const pkgTxt = await p.evaluate(() => {
    const labs = [...document.querySelectorAll('.pkgr label')].map(l => l.textContent.trim());
    return labs.join(" | ");
  });
  const hasFoil = /Stick Pack Foil/i.test(pkgTxt);
  const hasDisplay = /Display/i.test(pkgTxt);
  const hasShipper = /Master Shipper/i.test(pkgTxt);
  const hasBottleSlot = /Bottle|Cap|Closure|Scoop|Canister/i.test(pkgTxt);
  const badges = await p.evaluate(() => document.body.innerText);
  const stickBadge = /Enova std \$0\.15\/stick/i.test(badges);
  const displayBadge = /Enova std \$1\.00/i.test(badges);

  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/stickpack-formulation.png", fullPage: true });

  // ── B) Project Page: editable prices + MFSO button + blank labor tech ──
  await p.click('.app-nav-item:has-text("Projects")'); await p.waitForTimeout(400);
  const cell = await p.$('.ppn'); // first project row opens the project page
  // Projects page uses a table; click the first project number link
  const firstPn = await p.$('a, .pnlink, td');
  await p.evaluate(() => { const el=[...document.querySelectorAll('td,a,span')].find(e=>/^P\d{5}/.test((e.textContent||'').trim())); if(el) el.click(); });
  await p.waitForTimeout(700);
  const priceInputs = await p.$$eval('.pp-price-in', els => els.length);
  const hasMFSObtn = await p.evaluate(() => [...document.querySelectorAll('button')].some(b => /Go to MFSO|Open Signed MFSO/.test(b.textContent||'')));
  // labor tech cell should not show a PM name (Carlos) — it renders '—' when laborTech unset
  const laborRowBlank = await p.evaluate(() => {
    const rows=[...document.querySelectorAll('tr')];
    const lr=rows.find(r=>/Production labor/.test(r.innerText||''));
    if(!lr) return "no-labor-row";
    const tds=[...lr.querySelectorAll('td')];
    return tds[1] ? tds[1].textContent.trim() : "?";
  });
  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/stickpack-projectpage.png", fullPage: true });

  console.log("A) form:", dosage, "| slots:", pkgTxt);
  console.log("   foil:", hasFoil, "display:", hasDisplay, "shipper:", hasShipper, "| bottle/scoop present:", hasBottleSlot);
  console.log("   $0.15/stick badge:", stickBadge, "| $1.00 display badge:", displayBadge);
  console.log("B) price inputs on project page:", priceInputs, "| MFSO button:", hasMFSObtn, "| labor tech cell:", JSON.stringify(laborRowBlank));
  console.log("pageerrors:", errs.length ? errs.join("; ") : "none");

  const okA = /stick/i.test(dosage) && hasFoil && hasDisplay && hasShipper && !hasBottleSlot && stickBadge && displayBadge;
  const okB = priceInputs > 0 && hasMFSObtn && laborRowBlank !== "Carlos Miranda";
  console.log((okA && okB && errs.length===0) ? "\nSTICKPACK + PROJECT-PAGE DRIVE PASSED" : "\nDRIVE INCOMPLETE — see values");
  await b.close();
  process.exit((okA && okB && errs.length===0) ? 0 : 1);
})();
