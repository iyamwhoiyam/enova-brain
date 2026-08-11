// §49 real-browser drive of the commitment gate (Active/Archive/All + commitment editor + board toggle).
const { execSync } = require("child_process");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
let chromium;
try { ({ chromium } = require(NG + "/playwright")); }
catch (_) { console.log("SKIP: playwright not installed"); process.exit(0); }
(async () => {
  try { execSync("node build_prod.js", { cwd: __dirname, stdio:"pipe" }); execSync("node build_offline.js", { cwd: __dirname, stdio:"pipe" }); }
  catch (e) { console.log("FAIL: build errored: " + ((e.stdout||e.message||e).toString().slice(0,300))); process.exit(1); }
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on("pageerror", e => errs.push(String(e.message||e)));
  const A = []; const ok = (c,m)=>{ A.push((c?"✓":"✗")+" "+m); };
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
  await p.waitForSelector(".app-nav-item", { timeout: 15000 });

  // Projects tab (now the sole records grid) → defaults to Open lifecycle + Active scope, fewer rows than All
  await p.click('.app-nav-item:has-text("Projects")'); await p.waitForTimeout(500);
  ok(await p.$('.scope-seg'), "Active/Archive/All segmented control present");
  const seg = await p.$$eval('.scope-seg button', els => els.map(e=>({t:e.textContent.trim(), on:e.classList.contains('on')})));
  // Scope model is now the §59 lifecycle buckets (Pipeline/Prospects/Committed/Production/Delivered/Archived/All).
  // The default working scope is the live "Pipeline" set (was "Active" in the old model).
  const onBtn = seg.find(s=>s.on);
  ok(onBtn && /Pipeline/.test(onBtn.t), "defaults to the live Pipeline scope ("+(onBtn?onBtn.t:'none')+")");
  const nActive = await p.$$eval('.ptbl tbody tr', r=>r.length);
  // switch to All → should show many more rows
  await p.click('.scope-seg button:has-text("All")'); await p.waitForTimeout(400);
  const nAll = await p.$$eval('.ptbl tbody tr', r=>r.length);
  ok(nAll > nActive, "Active shows fewer than All ("+nActive+" active vs "+nAll+" all)");
  // Commitment column present
  const heads = await p.$$eval('.ptbl thead th .th-lbl', el=>el.map(e=>e.textContent.trim()));
  ok(heads.includes('Commitment'), "Commitment column present ("+heads.join(',')+")");
  await p.screenshot({ path:(process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/commit-open.png" });

  // Archive scope shows the uncommitted leads
  await p.click('.scope-seg button:has-text("Archive")'); await p.waitForTimeout(400);
  const nArch = await p.$$eval('.ptbl tbody tr', r=>r.length);
  ok(nArch > 0, "Archive scope lists uncommitted leads ("+nArch+")");

  // Open an archived lead → Project Page → Commitment card → check NDA → becomes Active
  await p.click('.ptbl tbody tr'); await p.waitForTimeout(500);
  ok(await p.$('.pp-page'), "project page opens");
  const commitCard = await p.evaluate(()=>{ const h=[...document.querySelectorAll('.pp-card-h')].find(e=>/Commitment/.test(e.textContent)); return !!h; });
  ok(commitCard, "Commitment card on the project page");
  const pipeBefore = await p.evaluate(()=>{ const c=[...document.querySelectorAll('.pp-card')].find(x=>/Commitment/.test(x.querySelector('.pp-card-h').textContent)); return c.querySelector('.fbadge').textContent.trim(); });
  // toggle NDA signed
  const ndaBox = await p.evaluateHandle(()=>{ const c=[...document.querySelectorAll('.pp-card')].find(x=>/Commitment/.test(x.querySelector('.pp-card-h').textContent)); const lab=[...c.querySelectorAll('label.pp-f')].find(l=>/NDA signed/.test(l.textContent)); return lab.querySelector('input[type=checkbox]'); });
  await ndaBox.asElement().click(); await p.waitForTimeout(400);
  const pipeAfter = await p.evaluate(()=>{ const c=[...document.querySelectorAll('.pp-card')].find(x=>/Commitment/.test(x.querySelector('.pp-card-h').textContent)); return c.querySelector('.fbadge').textContent.trim(); });
  ok(/lead/i.test(pipeBefore) && /active/i.test(pipeAfter), "signing NDA promotes lead → active ("+pipeBefore+" → "+pipeAfter+")");
  const ndaBadge = await p.evaluate(()=>{ const c=[...document.querySelectorAll('.pp-card')].find(x=>/Commitment/.test(x.querySelector('.pp-card-h').textContent)); return /NDA/.test(c.textContent); });
  ok(ndaBadge, "NDA signal badge shows after signing");
  await p.screenshot({ path:(process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/commit-card.png" });

  // Workflow board (WIP) has the Active-only toggle, default on
  await p.click('.pp-back'); await p.waitForTimeout(300);
  await p.click('.app-nav-item:has-text("WIP Board")'); await p.waitForTimeout(500);
  ok(await p.$('.flt-btn:has-text("Active only")'), "board has an Active-only toggle");

  console.log(A.join("\n"));
  console.log("\npage errors: " + (errs.length ? errs.join(" | ") : "NONE"));
  const failed = A.some(l=>l.startsWith("✗"));
  console.log(!failed && errs.length===0 ? "\nCOMMITMENT GATE DRIVE: PASS" : "\nCOMMITMENT GATE DRIVE: FAIL");
  await b.close();
  process.exit(failed || errs.length ? 1 : 0);
})();
