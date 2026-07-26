// §48 real-browser drive of the Production Readiness board (offline build).
// Skips cleanly (exit 0) where Playwright/Chromium isn't installed (e.g. CI without browsers).
const { execSync } = require("child_process");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
let chromium;
try { ({ chromium } = require(NG + "/playwright")); }
catch (_) { console.log("SKIP: playwright not installed"); process.exit(0); }
(async () => {
  // Rebuild artifacts from CURRENT source so this drive covers live source, not a stale file.
  try { execSync("node build_prod.js", { cwd: __dirname, stdio:"pipe" }); execSync("node build_offline.js", { cwd: __dirname, stdio:"pipe" }); }
  catch (e) { console.log("FAIL: build errored: " + ((e.stdout||e.message||e).toString().slice(0,300))); process.exit(1); }
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", e => errs.push(String(e.message||e)));
  const A = []; const ok = (c,m)=>{ A.push((c?"✓":"✗")+" "+m); };
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });

  // ── WIP board: collapsed column header stays HORIZONTAL (not rotated) ──
  await p.click('.app-nav-item:has-text("WIP Board")'); await p.waitForTimeout(500);
  await p.locator('.col-head', { hasText: 'Pending Information' }).first().click(); await p.waitForTimeout(300);
  const wip = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.col-head-label')].find(e=>/pending information/i.test(e.textContent));
    const col = el.closest('.col'); const head = col.querySelector('.col-head');
    return { collapsed: col.classList.contains('col-collapsed'), bodyHidden: getComputedStyle(col.querySelector('.col-body')).display==='none', wm: getComputedStyle(head).writingMode };
  });
  ok(wip.collapsed && wip.bodyHidden, "WIP column collapses (body hidden)");
  ok(/horizontal/.test(wip.wm), "WIP collapsed header horizontal, not rotated ("+wip.wm+")");

  // ── Readiness board ──
  await p.click('.app-nav-item:has-text("Readiness")'); await p.waitForTimeout(600);
  ok(await p.$('.rdy-board'), "readiness board renders");
  const nCards0 = await p.$$eval('.rdy-card', els => els.length);

  // 1) KPI square click filters the board
  await p.click('.rdy-kpi.clickable:has-text("In production")'); await p.waitForTimeout(400);
  ok(await p.$('.rdy-filter-note'), "clicking a KPI shows the filter note");
  const filt = await p.evaluate(() => {
    const cols = [...document.querySelectorAll('.rdy-col')];
    const intake = cols.find(c=>/Intake/.test(c.querySelector('.rdy-col-head').textContent));
    const prod = cols.find(c=>/In Production/.test(c.querySelector('.rdy-col-head').textContent));
    return { intake: intake.querySelectorAll('.rdy-card').length, prod: prod.querySelectorAll('.rdy-card').length };
  });
  ok(filt.intake===0 && filt.prod>0, "KPI 'In production' filter → only production cards (intake "+filt.intake+", prod "+filt.prod+")");
  await p.click('.rdy-kpi.clickable:has-text("In pipeline")'); await p.waitForTimeout(300);
  const nCards1 = await p.$$eval('.rdy-card', els => els.length);
  ok(nCards1===nCards0, "clicking In-pipeline clears the filter (back to "+nCards1+")");

  // 2) Readiness column collapses with a HORIZONTAL header
  await p.locator('.rdy-col-head', { hasText: 'Intake' }).first().click(); await p.waitForTimeout(300);
  const rdyCol = await p.evaluate(() => {
    const col = [...document.querySelectorAll('.rdy-col')].find(c=>/Intake/.test(c.querySelector('.rdy-col-head').textContent));
    const head = col.querySelector('.rdy-col-head');
    return { collapsed: col.classList.contains('rdy-collapsed'), bodyHidden: getComputedStyle(col.querySelector('.rdy-col-body')).display==='none', wm: getComputedStyle(head).writingMode };
  });
  ok(rdyCol.collapsed && rdyCol.bodyHidden, "readiness column collapses (body hidden)");
  ok(/horizontal/.test(rdyCol.wm), "readiness collapsed header horizontal ("+rdyCol.wm+")");
  await p.locator('.rdy-col-head', { hasText: 'Intake' }).first().click(); await p.waitForTimeout(250); // expand back

  // 3) Drag a card from Intake → In Production (synthetic HTML5 DnD, stepped so React flushes dragPn)
  ok(await p.$eval('.rdy-card', el => el.getAttribute('draggable')==='true'), "cards are draggable");
  await p.evaluate(() => { const c=document.querySelector('.rdy-col .rdy-card'); window.__dt=new DataTransfer(); c.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:window.__dt})); });
  await p.waitForTimeout(150);
  await p.evaluate(() => { const col=[...document.querySelectorAll('.rdy-col')].find(c=>/In Production/.test(c.querySelector('.rdy-col-head').textContent)); col.dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:window.__dt})); col.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:window.__dt})); });
  await p.waitForTimeout(300);
  const moved = await p.$$eval('.rdy-card-override', els => els.length);
  ok(moved >= 1, "dragged card shows the manual-placement (⇄ moved) badge");

  // 4) Detail drawer: project info + document buttons + reset-to-auto for the moved card
  await p.click('.rdy-card .rdy-card-override >> nth=0').catch(()=>{}); // click the moved card
  if (!(await p.$('.rdy-drawer'))) { await p.click('.rdy-card'); }
  await p.waitForTimeout(400);
  ok(await p.$('.rdy-drawer'), "detail drawer opens");
  ok(await p.$('.rdy-proj'), "project & product panel present");
  const infoFields = await p.$$eval('.rdy-proj-grid > div', els => els.length);
  ok(infoFields >= 6, "project info fields shown (got "+infoFields+")");
  const docBtns = await p.$$eval('.rdy-doc-btn', els => els.map(e=>e.textContent.trim()));
  ok(docBtns.filter(t=>/MFSO|SO|MO|BOM|MMR/.test(t)).length >= 5, "all document buttons present ("+docBtns.join(',')+")");
  ok(await p.$('.rdy-drawer-head-actions .rdy-btn.ghost'), "Open Project / Open MFSO jumps present");
  // MFSO opens a print window
  const popupP = p.context().waitForEvent('page', { timeout: 5000 }).catch(()=>null);
  await p.click('.rdy-doc-btn:has-text("MFSO")');
  const popup = await popupP;
  ok(!!popup, "clicking MFSO opens the document window");
  if (popup) { await popup.waitForTimeout(400); ok(await popup.$('.__np button'), "popup has a manual Print button (no auto-print)"); await popup.close().catch(()=>{}); }
  await p.screenshot({ path: (process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/readiness-v2-detail.png", fullPage: false });

  console.log(A.join("\n"));
  console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "NONE"));
  const failed = A.some(l=>l.startsWith("✗"));
  console.log(!failed && errs.length===0 ? "\nREADINESS BROWSER DRIVE: PASS" : "\nREADINESS BROWSER DRIVE: FAIL");
  await b.close();
  process.exit(failed || errs.length ? 1 : 0);
})();
