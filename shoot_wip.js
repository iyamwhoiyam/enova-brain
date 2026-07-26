const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const { chromium } = require(NG + "/playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", e => errs.push(String(e.message||e)));
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });
  await p.click('.app-nav-item:has-text("WIP Board")'); await p.waitForTimeout(500);

  // 1) Column rename: "Lab/Sampling" present, "Formula Reviewed" gone
  const heads = await p.evaluate(() => [...document.querySelectorAll('.col-head-label')].map(e=>e.textContent.trim()));
  const hasLab = heads.some(h => /lab\/sampling/i.test(h));
  const hasOld = heads.some(h => /formula reviewed/i.test(h));

  // 2) Collapse: click the "Formulation/Sample Development" header → column collapses; click → expands
  const colOf = async (label) => p.evaluateHandle((lbl) => {
    const el = [...document.querySelectorAll('.col-head-label')].find(e=>e.textContent.trim().toLowerCase().startsWith(lbl));
    return el ? el.closest('.col') : null; }, label);
  const head = p.locator('.col-head', { hasText: 'Formulation/Sample Development' }).first();
  await head.click(); await p.waitForTimeout(350);
  const collapsedNow = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.col-head-label')].find(e=>/formulation\/sample/i.test(e.textContent));
    return el ? el.closest('.col').classList.contains('col-collapsed') : false; });
  const bodyHidden = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.col-head-label')].find(e=>/formulation\/sample/i.test(e.textContent));
    const body = el.closest('.col').querySelector('.col-body');
    return body ? getComputedStyle(body).display === 'none' : false; });
  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/wip-collapsed.png", fullPage: false });
  await head.click(); await p.waitForTimeout(350);
  const expandedBack = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.col-head-label')].find(e=>/formulation\/sample/i.test(e.textContent));
    return el ? !el.closest('.col').classList.contains('col-collapsed') : false; });

  // 3) Project Page — open a card, verify the PN edit (✎ #) + Delete controls, and that clicking edit shows the input
  await p.click('.card'); await p.waitForTimeout(500);
  const onPage = await p.$('.pp-page');
  const hasEditBtn = await p.evaluate(() => !!([...document.querySelectorAll('.pp-title button')].find(b=>/#/.test(b.textContent))));
  const hasDelete = await p.evaluate(() => !!([...document.querySelectorAll('.pp-title-actions button')].find(b=>/delete/i.test(b.textContent))));
  // click the ✎ # to reveal the inline input
  const editBtn = await p.evaluateHandle(() => [...document.querySelectorAll('.pp-title button')].find(b=>/#/.test(b.textContent)));
  if (editBtn) { await editBtn.asElement()?.click(); await p.waitForTimeout(250); }
  const inputShown = await p.evaluate(() => !!document.querySelector('.pp-title input'));
  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/wip-projectpage-pnedit.png", fullPage: false });

  console.log("Lab/Sampling column present:", hasLab, "| 'Formula Reviewed' gone:", !hasOld);
  console.log("column collapsed on header click:", collapsedNow, "| body hidden:", bodyHidden, "| expands back:", expandedBack);
  console.log("ProjectPage opened:", !!onPage, "| ✎# edit btn:", hasEditBtn, "| Delete btn:", hasDelete, "| input reveals on click:", inputShown);
  console.log("pageerrors:", errs.length ? errs.join("; ") : "none");
  const ok = hasLab && !hasOld && collapsedNow && bodyHidden && expandedBack && !!onPage && hasEditBtn && hasDelete && inputShown && errs.length===0;
  console.log(ok ? "\nWIP + PROJECT-PAGE DRIVE PASSED" : "\nDRIVE INCOMPLETE — see values");
  await b.close(); process.exit(ok?0:1);
})();
