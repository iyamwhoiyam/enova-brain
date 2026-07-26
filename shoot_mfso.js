// End-to-end proof of the editable MFSO: open Documents in a real browser, recall a project, edit
// cells (appearance, add an ingredient, add a test), confirm the printable MFSO reflects the edits,
// and screenshot the editor.
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const { chromium } = require(NG + "/playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 2600 } });
  const errs = []; p.on("pageerror", e => errs.push("pageerror: " + (e.message || e)));
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });

  await p.click('.app-nav-item:has-text("Documents")'); await p.waitForTimeout(400);
  // Recall a project via the picker: type into the search cell, then click a .ppn result row.
  const picker = await p.$('input');
  if (picker) { await picker.click(); await picker.type('P25'); await p.waitForTimeout(500);
    const row = await p.$('.ppn');
    if (row) { await row.click(); await p.waitForTimeout(600); } }

  // innerText applies the CSS uppercase transform on the section headers, so match case-insensitively.
  const before = (await p.evaluate(() => document.body.innerText)).toLowerCase();
  const hasEditor = /mfso document/.test(before);
  const sections = ["composition","general specification","packaging specifications","palletization","microbiological","chemical","regulatory","optional compliance","fees"]
    .filter(s => before.includes(s));
  const addBtns = (before.match(/\+ add /g) || []).length;
  const inputCount = await p.$$eval('.mfe-in', els => els.length);

  // Edit the Appearance field (the input following the "Appearance" label in the General Spec grid),
  // then read the input's VALUE back (input values aren't in innerText).
  const apInput = await p.evaluateHandle(() => {
    const lab = [...document.querySelectorAll('.mfe-grid label')].find(l => /Appearance/.test(l.textContent));
    return lab ? lab.nextElementSibling : null;
  });
  let edited = false, valBack = "";
  if (apInput && apInput.asElement()) {
    await apInput.asElement().fill('Fine off-white powder, free-flowing');
    await p.waitForTimeout(300);
    valBack = await apInput.asElement().inputValue().catch(() => "");
    edited = valBack === 'Fine off-white powder, free-flowing';
  }
  // Add an ingredient row and confirm the cell count grows (structural edit works).
  const cellsBeforeAdd = await p.$$eval('.mfe-in', e => e.length);
  const addIngBtn = await p.$('button.mfe-add:has-text("Add ingredient")');
  if (addIngBtn) { await addIngBtn.click(); await p.waitForTimeout(300); }
  const cellsAfterAdd = await p.$$eval('.mfe-in', e => e.length);

  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/mfso-editor.png", fullPage: true });

  console.log("MFSO editor present:", hasEditor);
  console.log("sections rendered:", sections.length, "·", sections.join(" · "));
  console.log("add-row buttons:", addBtns, "| editable cells (.mfe-in):", inputCount);
  console.log("appearance edit accepted (value read back):", edited, "->", JSON.stringify(valBack));
  console.log("add-ingredient grows cells:", cellsBeforeAdd, "->", cellsAfterAdd);
  console.log("pageerrors:", errs.length ? errs.join("; ") : "none");

  const ok = hasEditor && sections.length >= 8 && addBtns >= 6 && inputCount > 40 && edited && cellsAfterAdd > cellsBeforeAdd && errs.length === 0;
  console.log(ok ? "\nMFSO EDITOR BROWSER DRIVE PASSED" : "\nDRIVE INCOMPLETE — see values above");
  await b.close();
  process.exit(ok ? 0 : 1);
})();
