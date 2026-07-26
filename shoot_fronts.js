// §53 — two operational fronts (Commercial vs Production) + May-2025 scope, verified in a real browser.
const { execSync } = require("child_process");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
let chromium; try { ({ chromium } = require(NG + "/playwright")); } catch(_){ console.log("SKIP: no playwright"); process.exit(0); }
(async () => {
  try { execSync("node build_prod.js",{cwd: __dirname,stdio:"pipe"}); execSync("node build_offline.js",{cwd: __dirname,stdio:"pipe"}); }
  catch(e){ console.log("FAIL build: "+((e.stdout||e.message||e).toString().slice(0,300))); process.exit(1); }
  const b = await chromium.launch({ headless:true });
  const p = await b.newPage({ viewport:{width:1680,height:1000} });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e.message||e)));
  const A=[]; const ok=(c,m)=>A.push((c?"✓":"✗")+" "+m);
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href,{waitUntil:"load",timeout:30000});
  await p.waitForSelector(".app-nav-item",{timeout:15000});
  await p.click('.app-nav-item:has-text("WIP Board")'); await p.waitForTimeout(700);

  const frontBtns = await p.$$eval('.flt-btn', els=>els.map(e=>e.textContent.trim()));
  ok(frontBtns.some(t=>/Commercial/.test(t)) && frontBtns.some(t=>/Production/.test(t)), "Front control (Commercial / Production) present");
  ok(frontBtns.some(t=>/May 2025/.test(t)), "May-2025 scope toggle present");

  const cols = async()=> p.$$eval('.board .col', e=>e.length);
  const allN = await cols();
  await p.click('.flt-btn:has-text("Commercial")'); await p.waitForTimeout(400);
  const commN = await cols();
  await p.click('.flt-btn:has-text("Production")'); await p.waitForTimeout(400);
  const prodN = await cols();
  ok(commN>0 && commN<allN, `Commercial shows a subset of columns (${commN} of ${allN})`);
  ok(prodN>0 && prodN<commN, `Production shows fewer columns than Commercial (${prodN} < ${commN})`);
  ok(commN+prodN===allN, `Commercial + Production == All columns (${commN}+${prodN}==${allN})`);

  // Projects grid: scope hides older, label reports it
  await p.click('.app-nav-item:has-text("Projects")'); await p.waitForTimeout(600);
  const label = await p.$eval('.gen-top .fsmall', e=>e.textContent.trim()).catch(()=>'');
  ok(/shown/.test(label), "Projects grid shows a scope summary ("+label+")");

  console.log(A.join("\n"));
  console.log("\npage errors: "+(errs.length?errs.join(" | "):"NONE"));
  const failed=A.some(l=>l.startsWith("✗"));
  console.log(!failed&&!errs.length?"\nFRONTS+SCOPE DRIVE: PASS":"\nFRONTS+SCOPE DRIVE: FAIL");
  await b.close(); process.exit(failed||errs.length?1:0);
})();
