// §68 command palette — real-browser ⌘K drive.
const NG=process.env.ENOVA_NG||"/home/claude/.npm-global/lib/node_modules";
let chromium; try{({chromium}=require(NG+"/playwright"));}catch(_){console.log("SKIP");process.exit(0);}
(async()=>{
  const b=await chromium.launch({headless:true}); const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on("pageerror",e=>errs.push(String(e.message||e)));
  const A=[]; const ok=(c,m)=>A.push((c?"✓":"✗")+" "+m);
  await p.goto("file:///root/index.offline.html",{waitUntil:"load",timeout:30000});
  await p.waitForSelector(".app-nav-item",{timeout:15000});
  ok(await p.$('.app-search'), "sidebar Search (⌘K) trigger present");
  // open via Ctrl+K
  await p.keyboard.down('Control'); await p.keyboard.press('KeyK'); await p.keyboard.up('Control'); await p.waitForTimeout(300);
  ok(await p.$('.cmdk'), "⌘K opens the command palette");
  // type a page name → results appear
  await p.type('.cmdk-input','Command'); await p.waitForTimeout(300);
  const items = await p.$$eval('.cmdk-item .cmdk-lbl', els=>els.map(e=>e.textContent));
  ok(items.some(t=>/Command Center/.test(t)), "typing filters to pages ("+items.slice(0,3).join(' | ')+")");
  await p.screenshot({path:"/root/shots/cmdk.png"});
  // Enter navigates
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  const title=await p.$eval('.gen-title',e=>e.textContent).catch(()=>'');
  ok(/Command Center/.test(title), "Enter jumps to the page (title: "+title+")");
  ok(!(await p.$('.cmdk')), "palette closes after selection");
  console.log(A.join("\n"));
  console.log("\npage errors: "+(errs.length?errs.join(" | "):"NONE"));
  const failed=A.some(l=>l.startsWith("✗"));
  console.log(!failed&&!errs.length?"\nCMDK DRIVE: PASS":"\nCMDK DRIVE: FAIL");
  await b.close(); process.exit(failed||errs.length?1:0);
})();
