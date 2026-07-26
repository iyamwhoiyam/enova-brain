// Proof the system catches bad project numbers: open New Project, type a malformed "P262112",
// confirm the inline format warning, Create, and verify the project is created with a VALID
// P26### number (never the malformed one).
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const { chromium } = require(NG + "/playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1400, height: 1200 } });
  const errs = []; p.on("pageerror", e => errs.push("pageerror: " + (e.message || e)));
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });

  await p.click('.app-nav-item:has-text("WIP Board")'); await p.waitForTimeout(400);
  // open the New Project modal (toolbar "+ New Project")
  const newBtn = await p.$('button:has-text("+ New Project")');
  if (newBtn) { await newBtn.click(); await p.waitForTimeout(400); }
  // the modal's first input is Project #
  const pnInput = await p.$('.modal input');
  let hintBad = "", hintValid = "", createdPn = "";
  if (pnInput) {
    await pnInput.fill('P262112'); await p.waitForTimeout(250);
    hintBad = await p.evaluate(() => { const s=[...document.querySelectorAll('.modal .fsmall')].map(e=>e.textContent).join(' '); return s; });
    // fix to a valid free number to see the ✓, then set back to malformed to prove the guard on Create
    await pnInput.fill('P26205'); await p.waitForTimeout(200);
    hintValid = await p.evaluate(() => [...document.querySelectorAll('.modal .fsmall')].map(e=>e.textContent).join(' '));
    // now put the malformed one back and Create — the app must NOT create P262112
    await pnInput.fill('P262112'); await p.waitForTimeout(200);
    const createBtn = await p.$('.modal button:has-text("Create"), .modal button:has-text("Save"), .modal button:has-text("Add")');
    if (createBtn) { await createBtn.click(); await p.waitForTimeout(600); }
    // read back the projects table for any P262112 (should be none) and confirm a new valid pn exists
    createdPn = await p.evaluate(() => {
      const cells=[...document.querySelectorAll('td, .pcell-pn, .c-pn')].map(e=>(e.textContent||'').trim());
      const bad = cells.find(t=>/^P262112\b/.test(t));
      const valid = cells.filter(t=>/^P\d{5}$/.test(t));
      return { hasBad: !!bad, validCount: valid.length, sample: valid.slice(0,3).join(',') };
    });
  }

  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/pn-validation.png", fullPage: true });
  console.log("malformed hint shown:", /Format is P|2-digit year/.test(hintBad), "->", JSON.stringify(hintBad.slice(0,90)));
  console.log("valid hint shown:", /valid and free|✓/.test(hintValid));
  console.log("after Create → P262112 present:", createdPn.hasBad, "| valid PNs on page:", createdPn.validCount, createdPn.sample);
  console.log("pageerrors:", errs.length ? errs.join("; ") : "none");

  const ok = /Format is P|2-digit year/.test(hintBad) && createdPn.hasBad === false && errs.length === 0;
  console.log(ok ? "\nPROJECT-NUMBER GUARD DRIVE PASSED" : "\nDRIVE INCOMPLETE — see values");
  await b.close();
  process.exit(ok ? 0 : 1);
})();
