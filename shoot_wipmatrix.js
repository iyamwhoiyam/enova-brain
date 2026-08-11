// §64 manager-swimlane WIP matrix — real-browser structure + toggle drive.
const { execSync } = require("child_process");
const NG=process.env.ENOVA_NG||"/home/claude/.npm-global/lib/node_modules";
let chromium; try{({chromium}=require(NG+"/playwright"));}catch(_){console.log("SKIP: no playwright");process.exit(0);}
(async()=>{
  try { execSync("node build_prod.js",{cwd:"/root",stdio:"pipe"}); execSync("node build_offline.js",{cwd:"/root",stdio:"pipe"}); }
  catch(e){ console.log("FAIL build: "+((e.stdout||e.message||e).toString().slice(0,300))); process.exit(1); }
  const b=await chromium.launch({headless:true});
  const p=await b.newPage({viewport:{width:1680,height:1000}});
  const errs=[]; p.on("pageerror",e=>errs.push(String(e.message||e)));
  const A=[]; const ok=(c,m)=>A.push((c?"✓":"✗")+" "+m);
  await p.goto("file:///root/index.offline.html",{waitUntil:"load",timeout:30000});
  await p.waitForSelector(".app-nav-item",{timeout:15000});
  await p.click('.app-nav-item:has-text("WIP Board")'); await p.waitForTimeout(700);

  // Matrix is the default (rowMode='pm')
  ok(await p.$('.wipm'), "manager-swimlane matrix renders by default");
  const rowHeads = await p.$$eval('.wipm-rhead .wipm-rname', els=>els.map(e=>e.textContent.trim()));
  ok(['Carlos','Tong','Marina','Nick','Jonathan','Joseph'].every(n=>rowHeads.includes(n)),
     "all fixed Enova managers are row headers ("+rowHeads.join(', ')+")");
  const colHeads = await p.$$eval('.wipm-chead .col-head-label', els=>els.map(e=>e.textContent.trim()));
  ok(colHeads.length>0, "stage column headers present ("+colHeads.length+" columns: "+colHeads.slice(0,3).join(' · ')+"…)");
  ok(await p.$('.wipm-corner'), "corner 'Manager / Stage' label present");
  await p.screenshot({path:"/root/shots/wip-matrix.png"});

  // Name filter collapses to one lane
  await p.click('.rep-btn:has-text("Marina")').catch(()=>{}); await p.waitForTimeout(400);
  const rowsFiltered = await p.$$eval('.wipm-rhead .wipm-rname', els=>els.map(e=>e.textContent.trim()));
  ok(rowsFiltered.length===1 && rowsFiltered[0]==='Marina', "name filter collapses matrix to one manager lane ("+rowsFiltered.join(',')+")");
  await p.click('.rep-btn.danger:has-text("Clear")').catch(()=>{}); await p.waitForTimeout(300);

  // Toggle to Flat and back
  await p.click('.rep-btn:has-text("Flat")'); await p.waitForTimeout(400);
  ok((await p.$('.board .col')) && !(await p.$('.wipm')), "Rows→Flat shows the classic column board");
  await p.click('.rep-btn:has-text("Managers")'); await p.waitForTimeout(400);
  ok((await p.$('.wipm')) && !(await p.$('.board .col')), "Rows→Managers returns to the matrix");

  console.log(A.join("\n"));
  console.log("\npage errors: "+(errs.length?errs.join(" | "):"NONE"));
  const failed=A.some(l=>l.startsWith("✗"));
  console.log(!failed&&!errs.length?"\nWIP MATRIX DRIVE: PASS":"\nWIP MATRIX DRIVE: FAIL");
  await b.close(); process.exit(failed||errs.length?1:0);
})();
