// Document & workbook COST CORRECTNESS (§28). Guards the bulk-aware batch basis + the retail
// master-shipper packaging spread so production docs (BOM/MMR/MO) and the quote never regress:
//   #1/#2  docIngredientRows / docBlendKgBatch — bulk batch mass is NOT 60× overcounted
//   #3     docPackagingRows — master shipper/display counted per CASE (ceil(units/casePack)),
//          not one-per-unit; capsule shells counted per PIECE
//   #5     buildAuditWorkbook "Cost/unit" uses servings-per-COSTING-UNIT (bulk = 1/servingSize),
//          so the Master Formula sheet agrees with the Batch Cost Build sheet
//   #4     FormulationEditor live pkgCPU spreads the master shipper across the case pack for
//          RETAIL (charging a whole shipper to every bottle overstated COGS)
const fs=require("fs");
const NG=process.env.ENOVA_NG||require("path").join(__dirname,"node_modules");
const html=fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")),"utf8");
let fail=0; const A=(c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };
const near=(a,b,eps)=>Math.abs(a-b)<=(eps==null?1e-6:eps);

// ── Part A: pure builders (slice module fns, inject controlled INV_IX/config) ──
function sliceFn(name){ const s=html.indexOf("function "+name+"("); let i=html.indexOf("{",s),d=0,e=-1;
  for(;i<html.length;i++){ if(html[i]==="{")d++; else if(html[i]==="}"){d--; if(d===0){e=i+1;break;}} } return html.slice(s,e); }
const INV_IX={
  ING:{n:"ING",d:"Test Active",u:0.05,q:100},
  SHELL:{n:"SHELL",d:"Capsule shell 00",u:0.02,q:100},
  BOT:{n:"BOT",d:"Bottle",u:0.22877,q:100}, CAP:{n:"CAP",d:"Cap",u:0.1716,q:100},
  LAB:{n:"LAB",d:"Label",u:0.115,q:100}, BAG:{n:"BAG",d:"Bulk bag",u:0.10,q:100},
  SHIP:{n:"SHIP",d:"Master shipper",u:1.00,q:100},
};
const CONTAINER_TYPES={
  'Bottle':{unitWord:'Bottle',bulk:false,pkg:[{k:'container',l:'Bottle'},{k:'closure',l:'Cap'},{k:'label',l:'Label'},{k:'shipper',l:'Master Shipper'}]},
  'Bulk Bag':{unitWord:'Bulk Bag',bulk:true,pkg:[{k:'bag',l:'Bulk Bag'},{k:'shipper',l:'Master Shipper'}]},
  'Stick-Pack Box':{unitWord:'Box',bulk:false,pkg:[{k:'foil',l:'Stick Pack Foil'},{k:'display',l:'Display'},{k:'shipper',l:'Master Shipper'}]},
};
const FORM_CFG={ 'Gummies - Bulk':{gummy:true}, 'Capsules':{shell:true} };
const defaultContainerFor=(f,b)=>b?'Bulk Bag':'Bottle';
// House-standard finished-goods costs — mirror the app's module-level constants so the sliced
// doc builders see the same values ($0.15 label / $0.15 stick pack / $1.00 stick display box).
const ENOVA_LABEL_COST=0.15, ENOVA_STICKPACK_COST=0.15, ENOVA_STICK_DISPLAY_COST=1.00;
const body=["const ENOVA_LABEL_COST="+ENOVA_LABEL_COST+", ENOVA_STICKPACK_COST="+ENOVA_STICKPACK_COST+", ENOVA_STICK_DISPLAY_COST="+ENOVA_STICK_DISPLAY_COST+";",
  sliceFn("docBatchBasis"),sliceFn("docIngredientRows"),sliceFn("docPackagingRows"),
  sliceFn("docBlendKgBatch"),sliceFn("buildAuditWorkbook"),
  "return {docBatchBasis,docIngredientRows,docPackagingRows,docBlendKgBatch,buildAuditWorkbook};"].join("\n");
const M=new Function("INV_IX","CONTAINER_TYPES","FORM_CFG","defaultContainerFor","isLocked","fmtTs","nowISO",body)(
  INV_IX,CONTAINER_TYPES,FORM_CFG,defaultContainerFor,()=>false,x=>String(x||""),()=>"2026-01-01");

// A1 — BULK gummy: 150,000 gummies, 2 gummies/serving, 500 mg active/serving, 3 g/gummy.
const bulk={ dosageForm:'Gummies - Bulk', servingSize:2, servingsPerUnit:30, batchUnits:150000,
  overage:0, gummyWt:3000, ingredients:[{item:{n:'ING'},inputMg:500,potencyPct:100}],
  cogsBreakdown:{piecesPerContainer:1,isBulk:true,casePack:5000,container:'Bulk Bag'},
  containerType:'Bulk Bag', isBulk:true, unitsPerCase:5000, pkg:{bag:{n:'BAG'},shipper:{n:'SHIP'}} };
const bIng=M.docIngredientRows(bulk)[0];
console.log("bulk active kg/batch:", bIng.kgBatch.toFixed(3), "(expect 37.500)");
A(near(bIng.kgBatch,37.5,0.01), "bulk active NOT 60× overcounted (37.5 kg, got "+bIng.kgBatch.toFixed(3)+")");
A(bIng.kgBatch<100, "bulk active kg is per-gummy scale, not 2250 kg");
const bBlend=M.docBlendKgBatch(bulk);
console.log("bulk total blend kg:", bBlend.toFixed(1), "(expect 450.0)");
A(near(bBlend,450,0.5), "bulk blend = gummyWt × pieces (450 kg, got "+bBlend.toFixed(1)+")");
const bPkg=M.docPackagingRows(bulk);
const bShip=bPkg.find(r=>/Master Shipper/.test(r.name));
A(bShip && bShip.qtyEach===30, "bulk master shipper = ceil(150000/5000)=30 cases, got "+(bShip&&bShip.qtyEach));
A(bShip && bShip.uom==='cases', "bulk shipper uom is 'cases'");

// A2 — RETAIL capsule bottle: 5,000 bottles × 60 caps.
const retail={ dosageForm:'Capsules', servingSize:2, servingsPerUnit:30, batchUnits:5000,
  overage:0.03, ingredients:[{item:{n:'ING'},inputMg:400,potencyPct:100}], shellItem:{n:'SHELL'},
  cogsBreakdown:{piecesPerContainer:60,isBulk:false,casePack:12,container:'Bottle'},
  containerType:'Bottle', isBulk:false, unitsPerCase:12,
  pkg:{container:{n:'BOT'},closure:{n:'CAP'},label:{n:'LAB'},shipper:{n:'SHIP'}} };
const rPkg=M.docPackagingRows(retail);
const rShell=rPkg.find(r=>/shell/i.test(r.name));
const rCont=rPkg.find(r=>/Bottle/.test(r.name)&&!/Shipper/.test(r.name));
const rShip=rPkg.find(r=>/Master Shipper/.test(r.name));
A(rShell && rShell.qtyEach===300000, "retail shells = 60×5000 = 300,000 pieces, got "+(rShell&&rShell.qtyEach));
A(rCont && rCont.qtyEach===5000 && rCont.uom==='ea', "retail bottle = 5,000 ea (per-unit), got "+(rCont&&rCont.qtyEach));
A(rShip && rShip.qtyEach===417 && rShip.uom==='cases', "retail master shipper = ceil(5000/12)=417 cases, got "+(rShip&&rShip.qtyEach));
// A2b — label is the house-standard flat $0.15 in the doc rows, NOT the blank SKU price (0.115).
const rLab=rPkg.find(r=>/Label/.test(r.name));
A(rLab && near(rLab.u, ENOVA_LABEL_COST), "retail label costed at house standard $0.15 (got "+(rLab&&rLab.u)+"), not blank SKU 0.115");

// A2c — STICK-PACK BOX: box is the unit holding N stick packs (= N servings @ 1 serving/stick).
// Each stick pack is its own label at $0.15, charged per PIECE like a capsule shell (N × $0.15),
// not once per box. 28 sticks/box × 1,000 boxes = 28,000 sticks; foil unit cost = $0.15. The DISPLAY
// box is the retail carton = the unit → one per unit at $1.00 (NOT spread per case).
const stick={ dosageForm:'Stickpacks', servingSize:1, servingsPerUnit:28, batchUnits:1000,
  overage:0.04, ingredients:[{item:{n:'ING'},inputMg:500,potencyPct:100}],
  cogsBreakdown:{piecesPerContainer:28,isBulk:false,casePack:24,container:'Stick-Pack Box'},
  containerType:'Stick-Pack Box', isBulk:false, unitsPerCase:24,
  pkg:{foil:{n:'LAB'},display:{n:'SHIP'},shipper:{n:'SHIP'}} };
const sPkg=M.docPackagingRows(stick);
const sFoil=sPkg.find(r=>/Stick Pack Foil/.test(r.name));
A(sFoil && sFoil.qtyEach===28000, "stick pack foil = 28×1000 = 28,000 sticks (per piece), got "+(sFoil&&sFoil.qtyEach));
A(sFoil && sFoil.uom==='sticks', "stick pack foil uom is 'sticks'");
A(sFoil && near(sFoil.u, ENOVA_STICKPACK_COST), "stick pack foil costed at house standard $0.15/stick, got "+(sFoil&&sFoil.u));
const sDisp=sPkg.find(r=>/Display/.test(r.name));
A(sDisp && sDisp.qtyEach===1000 && sDisp.uom==='ea', "stick display box = one per UNIT (1,000 ea), not per case, got "+(sDisp&&sDisp.qtyEach)+" "+(sDisp&&sDisp.uom));
A(sDisp && near(sDisp.u, ENOVA_STICK_DISPLAY_COST), "stick display box costed at house standard $1.00/ea, got "+(sDisp&&sDisp.u));

// A3 — workbook Master Formula "Cost/unit" uses bulk servings-per-unit (0.5), not 30.
const wb=M.buildAuditWorkbook(bulk);
const mf=wb.sheets.find(s=>s.name==='Master Formula').aoa;
const cps=mf[1][5], cpu=mf[1][6];   // cost/serving, cost/unit
console.log("workbook bulk cost/serving:", cps, "cost/unit:", cpu, "(expect 0.025 → 0.0125)");
A(near(cpu, cps*0.5, 1e-6), "Master Formula Cost/unit = cost/serving × 0.5 (bulk), got "+cpu);
A(cpu<cps*30, "Cost/unit is NOT the 30× retail servings basis");

// ── Part B: live FormulationEditor — RETAIL master-shipper spread (real inventory SKUs) ──
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const a=html.indexOf("(function(root){"); const endTok="})(typeof self!=='undefined'?self:this);";
const b=html.indexOf(endTok,a)+endTok.length; const mbRoot={};
new Function("self","module", html.slice(a,b)+"\n;return self.EnovaMasterBid;")(mbRoot,undefined);
const MB=mbRoot.EnovaMasterBid;
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__X__={FormulationEditor};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
const INV=JSON.parse(invData); const ix={}; INV.forEach(i=>ix[i.n]=i);
const rawIng=INV.find(i=>/Raw Ingredient|Powder/i.test(i.c)&&i.u>0)||INV.find(i=>i.u>0);
const SK={bot:'ALT-BT-0001', cap:'ALT-CA-0004', lab:'ALT-LL-0001', ship:'ALT-BX-012M'};
const uBot=ix[SK.bot].u, uCap=ix[SK.cap].u, uShip=ix[SK.ship].u;
const casePack=12;
// Label is the house-standard flat $0.15 (overrides the blank label-stock SKU price).
const expPerUnit=uBot+uCap+ENOVA_LABEL_COST, expSpread=uShip/casePack, expPkgCPU=expPerUnit+expSpread;
const noop=()=>{}; const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,location:{href:"",search:""},EnovaMasterBid:MB,EnovaBrain:require("./_kernel_for_tests")};
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node"},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>({from:()=>({select:()=>({})}),channel:()=>({on:()=>({subscribe:noop})}),auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})}})},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {FormulationEditor}=sb.globalThis.__X__;
const proj={pn:"P29997",customer:"TEST",product:"Test Caps",dosageForm:"Capsules",isBulk:false,
  containerType:"Bottle",servingSize:2,servingsPerUnit:30,batchUnits:5000,overage:0.03,unitsPerCase:casePack,
  shellItem:null, baseItems:{}, tierPricing:[],
  pkg:{container:{n:SK.bot},closure:{n:SK.cap},label:{n:SK.lab},shipper:{n:SK.ship}},
  ingredients:[{id:1,item:{n:rawIng.n},inputMg:400,potencyPct:100}] };
const s=ReactDOMServer.renderToString(React.createElement(FormulationEditor,{proj,projects:[proj],setProjects:noop,autoGenPn:null,onGenConsumed:noop}));
const clean=s.replace(/<!--\s*-->/g,'');
const mPkg=clean.match(/Packaging cost\/unit<\/span><span class="ftv">\$([0-9.]+)/);
const shownPkgCPU=mPkg?parseFloat(mPkg[1]):null;
console.log("retail packaging cost/unit shown:", shownPkgCPU, "| expected", expPkgCPU.toFixed(4),
  "| full-shipper bug would be", (expPerUnit+uShip).toFixed(4));
A(shownPkgCPU!=null, "packaging cost/unit is rendered");
A(shownPkgCPU!=null && near(shownPkgCPU, expPkgCPU, 0.0002), "retail pkgCPU spreads the master shipper across the case");
A(shownPkgCPU!=null && shownPkgCPU < expPerUnit+uShip-0.5, "master shipper is NOT charged in full to every unit");
A(/spread across/.test(clean) && /Master shipper/i.test(clean), "retail spread note renders");
A(/Enova std\s*\$0\.15/.test(clean), "label slot shows the 'Enova std $0.15' house-standard badge");

// ── Part C: live FormulationEditor — STICK-PACK BOX money path (user's exact scenario) ──
// A 28-serving box = 28 stick packs @ 1 serving/stick. Each stick pack IS its own label at $0.15,
// charged per stick pack (28 × $0.15 = $4.20/box), NOT once per box. The DISPLAY box is the retail
// carton = the unit → $1.00 once per unit (NOT spread per case). Only the master SHIPPER is per-case.
const spSticks=28, spCase=24, spBox=1000;
const expFoil=ENOVA_STICKPACK_COST*spSticks;             // 28 × 0.15 = 4.20 (per box, per piece)
const expStickPkgCPU=expFoil + ENOVA_STICK_DISPLAY_COST + uShip/spCase; // + $1 display/unit + shipper/case
const sProj={pn:"P29998",customer:"TEST",product:"Test Sticks",dosageForm:"Stickpacks",isBulk:false,
  containerType:"Stick-Pack Box",servingSize:1,servingsPerUnit:spSticks,batchUnits:spBox,overage:0.04,
  unitsPerCase:spCase, shellItem:null, baseItems:{}, tierPricing:[],
  pkg:{foil:{n:SK.bot},display:{n:SK.ship},shipper:{n:SK.ship}},
  ingredients:[{id:1,item:{n:rawIng.n},inputMg:500,potencyPct:100}] };
const s2=ReactDOMServer.renderToString(React.createElement(FormulationEditor,{proj:sProj,projects:[sProj],setProjects:noop,autoGenPn:null,onGenConsumed:noop}));
const clean2=s2.replace(/<!--\s*-->/g,'');
const mStick=clean2.match(/Packaging cost\/unit<\/span><span class="ftv">\$([0-9.]+)/);
const shownStick=mStick?parseFloat(mStick[1]):null;
console.log("stick-pack box packaging cost/unit shown:", shownStick, "| expected", expStickPkgCPU.toFixed(4),
  "| foil", expFoil.toFixed(2), "+ display $1.00 + shipper/case", (uShip/spCase).toFixed(4));
A(shownStick!=null, "stick-pack packaging cost/unit is rendered");
A(shownStick!=null && near(shownStick, expStickPkgCPU, 0.0002), "stick-pack box = N×$0.15 foil + $1 display/unit + shipper/case");
A(shownStick!=null && shownStick > expFoil-0.01, "stick-pack pkgCPU includes the full N×$0.15 stick cost (not a single stick)");
A(/Enova std\s*\$0\.15\/stick/.test(clean2), "foil slot shows the 'Enova std $0.15/stick' house-standard badge");
A(/Enova std\s*\$1\.00/.test(clean2), "stick display slot shows the 'Enova std $1.00' badge");

console.log("\n"+(fail===0?"DOCUMENT & WORKBOOK COST CHECKS PASSED":fail+" FAILED"));
process.exit(fail?1:0);
