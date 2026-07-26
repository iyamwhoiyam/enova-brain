// §52 — MOQ editable + margin↔price editable, verified in a real browser.
const { execSync } = require("child_process");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
let chromium; try { ({ chromium } = require(NG + "/playwright")); } catch(_){ console.log("SKIP: no playwright"); process.exit(0); }
const REQ = `Product Form: Powder
Servings per unit: 30
Serving size: 1 scoop
Ingredients:
Creatine Monohydrate 5000mg
L-Citrulline 3000mg`;
(async () => {
  try { execSync("node build_prod.js",{cwd: __dirname,stdio:"pipe"}); execSync("node build_offline.js",{cwd: __dirname,stdio:"pipe"}); }
  catch(e){ console.log("FAIL build: "+((e.stdout||e.message||e).toString().slice(0,300))); process.exit(1); }
  const b = await chromium.launch({ headless:true });
  const p = await b.newPage({ viewport:{width:1440,height:2200} });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e.message||e)));
  const A=[]; const ok=(c,m)=>A.push((c?"✓":"✗")+" "+m);
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href,{waitUntil:"load",timeout:30000});
  await p.waitForSelector(".app-nav-item",{timeout:15000});
  // build a costed formula
  await p.click('.app-nav-item:has-text("Formulation")'); await p.waitForTimeout(300);
  await p.click('button:has-text("+ New Formulation")'); await p.waitForTimeout(400);
  await p.click('button:has-text("Describe Product")'); await p.waitForTimeout(200);
  await p.fill('textarea', REQ); await p.waitForTimeout(150);
  await p.click('button:has-text("Extract")'); await p.waitForTimeout(700);
  await p.click('button:has-text("Apply to Formulation")'); await p.waitForTimeout(900);
  const wt = await p.$('input[placeholder="e.g. 4500"]'); if (wt){ await wt.fill('13000'); await p.waitForTimeout(300); }

  // ── MOQ editable ──
  const moq = p.locator('.ff label:text-is("MOQ") + input');
  ok(await moq.count()>0, "MOQ field present");
  ok(!(await moq.isDisabled()), "MOQ input is editable (not disabled)");
  await moq.fill('7500'); await moq.blur(); await p.waitForTimeout(400);
  ok((await moq.inputValue())==='7500', "MOQ accepts a custom value (7500)");
  // COGS breakdown shows it computed at the MOQ (batch is 0) → the total line mentions 7,500
  const cogsLine = await p.evaluate(()=>{ const el=[...document.querySelectorAll('.line.total')].find(x=>/Total COGS/.test(x.textContent)); return el?el.textContent:''; });
  ok(/7,?500/.test(cogsLine), "COGS basis follows the MOQ ("+cogsLine.replace(/\s+/g,' ').trim().slice(0,60)+")");

  // capture PN
  const pn = await p.evaluate(()=>{ const el=[...document.querySelectorAll('.ff')].find(f=>/Project #/.test(f.querySelector('label')?.textContent||'')); return el?el.querySelector('input').value:null; });
  ok(!!pn, "captured project # ("+pn+")");

  // ── Quote page: margin ↔ price ──
  await p.click('.app-nav-item:has-text("Quote")'); await p.waitForTimeout(400);
  // recall the project via the ProjectPicker search
  const search = p.locator('.proj-picker input').first();
  await search.click(); await p.waitForTimeout(150);
  await search.fill(pn); await p.waitForTimeout(350);
  await p.locator('.proj-picker-list .ppi', { has: p.locator('.ppn', { hasText: pn }) }).first().click();
  await p.waitForTimeout(800);
  await p.screenshot({ path:(process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/moq-margin.png", fullPage:true });
  const dbg = await p.evaluate(()=>{
    const tables=[...document.querySelectorAll('.ftbl')].map(tb=>({ heads:[...tb.querySelectorAll('th')].map(x=>x.textContent.trim()), rows:tb.querySelectorAll('tbody tr').length, inputsInFirstRow: tb.querySelector('tbody tr')?tb.querySelector('tbody tr').querySelectorAll('input').length:0 }));
    return { proj: !!document.querySelector('.gen-proj'), tables };
  });
  console.log("DEBUG page:", JSON.stringify(dbg));
  const tt = dbg.tables.find(t=>t.heads.some(h=>/Margin/.test(h)));
  ok(!!tt, "Quote tier table has COGS + Margin columns ("+(tt?tt.heads.join(' | '):'NOT FOUND')+")");
  if (tt){
    const tierTable = p.locator('.ftbl', { has: p.locator('th', { hasText:'Margin' }) });
    const firstRow = tierTable.locator('tbody tr').first();
    const priceInput  = firstRow.locator('input').nth(1);
    const marginInput = firstRow.locator('input').nth(2);
    try {
      await marginInput.fill('45',{timeout:6000}); await marginInput.blur(); await p.waitForTimeout(500);
      const priceVal = await priceInput.inputValue();
      ok(priceVal!=='' && Number(priceVal)>0, "entering 45% margin computed a sale price ($"+priceVal+")");
      await priceInput.fill(String((Number(priceVal)*1.2).toFixed(2)),{timeout:6000}); await priceInput.blur(); await p.waitForTimeout(500);
      const marVal = await marginInput.inputValue();
      ok(marVal!=='' && Number(marVal)>45, "raising the price raised the margin ("+marVal+"% > 45%)");
    } catch(e){ ok(false, "margin/price interaction failed: "+(e.message||e).toString().slice(0,80)); }
  }

  console.log(A.join("\n"));
  console.log("\npage errors: "+(errs.length?errs.join(" | "):"NONE"));
  const failed=A.some(l=>l.startsWith("✗"));
  console.log(!failed&&!errs.length?"\nMOQ+MARGIN DRIVE: PASS":"\nMOQ+MARGIN DRIVE: FAIL");
  await b.close(); process.exit(failed||errs.length?1:0);
})();
