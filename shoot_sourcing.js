const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const { chromium } = require(NG + "/playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs=[]; p.on("pageerror",e=>errs.push(String(e.message||e)));
  const A=[]; const ok=(c,m)=>A.push((c?"✓":"✗")+" "+m);
  await p.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href,{waitUntil:"load",timeout:30000});
  await p.waitForSelector(".app-nav-item",{timeout:15000});
  ok(await p.$('.app-nav-item:has-text("Sourcing")'), "Sourcing nav present");
  await p.click('.app-nav-item:has-text("Sourcing")'); await p.waitForTimeout(500);
  ok(await p.$('.gen-title'), "sourcing page renders");
  const rows = await p.$$eval('.ptbl tbody tr', r=>r.length);
  ok(rows>50, "catalog rows shown ("+rows+")");
  const kpi = await p.$$eval('.rdy-kpi-n', e=>e.map(x=>x.textContent));
  ok(kpi.length>=3, "KPIs shown ("+kpi.join('/')+")");
  // search
  await p.fill('.rdy-search','theanine'); await p.waitForTimeout(400);
  const rows2 = await p.$$eval('.ptbl tbody tr', r=>r.length);
  ok(rows2>0 && rows2<rows, "search narrows ("+rows2+")");
  const hasTh = await p.$$eval('.ptbl tbody tr td', t=>t.some(x=>/theanine/i.test(x.textContent)));
  ok(hasTh, "L-Theanine found via search");
  // add ingredient
  await p.fill('.rdy-search',''); await p.waitForTimeout(200);
  await p.click('.rdy-btn:has-text("Add ingredient")'); await p.waitForTimeout(200);
  await p.fill('.src-f input >> nth=0','Test Novel Active XYZ');
  await p.fill('.src-f input >> nth=2','0.055');
  await p.click('.panel .rdy-btn:has-text("Save")'); await p.waitForTimeout(400);
  await p.fill('.rdy-search','Novel Active XYZ'); await p.waitForTimeout(400);
  const added = await p.$$eval('.ptbl tbody tr td', t=>t.some(x=>/Novel Active XYZ/i.test(x.textContent)));
  ok(added, "added ingredient appears in the catalog");
  await p.screenshot({path:(process.env.ENOVA_SHOTS||require("path").join(__dirname,"shots"))+"/sourcing.png"});
  console.log(A.join("\n"));
  console.log("\npage errors: "+(errs.length?errs.join(" | "):"NONE"));
  const failed=A.some(l=>l.startsWith("✗"));
  console.log(!failed&&!errs.length?"\nSOURCING DRIVE: PASS":"\nSOURCING DRIVE: FAIL");
  await b.close(); process.exit(failed||errs.length?1:0);
})();
