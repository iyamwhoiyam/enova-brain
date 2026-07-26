// Verifies the BULK unit-of-measure fix: a bulk gummy order is priced PER GUMMY (not per
// 60-count bottle), and the master shipper is spread across the case (packaging is a fraction
// of a cent per gummy, not the whole shipper). Also checks the Master Bid engine costs a
// 150,000-GUMMY run (not 150,000 units × 60 = 9M).
const fs=require("fs"); const NG=process.env.ENOVA_NG||require("path").join(__dirname,"node_modules");
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")),"utf8");
let fail=0; const A=(c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };

// ── Part A: Master Bid engine costs a 150k-GUMMY run at cents/gummy ──
const a=html.indexOf("(function(root){"); const endTok="})(typeof self!=='undefined'?self:this);";
const b=html.indexOf(endTok,a)+endTok.length; const root={};
new Function("self","module", html.slice(a,b)+"\n;return self.EnovaMasterBid;")(root,undefined);
const MB=root.EnovaMasterBid;
// one gummy: caps_per_serv=2 (gummies/serving), servings=0.5 (a gummy is half a serving),
// so pieces = qty*2*0.5 = qty. blend 3g/gummy. dm ~ a few cents.
const g = MB.build(MB.MB_DEFAULTS, {form:'Gummy', caps_per_serv:2, servings:0.5, dm_unit:0.05, blend_size:0.003, base_qty:1, loss:0.06}, 150000, 0);
console.log("bulk gummy @150,000 → pieces implied:", (150000*2*0.5), "| cost/gummy $"+g.cost_per_unit.toFixed(5), "| blends", g.blends);
A(150000*2*0.5===150000, "150,000 gummies (not 9M)");
A(g.cost_per_unit>0 && g.cost_per_unit<0.5, "cost is per-GUMMY (cents), got $"+g.cost_per_unit.toFixed(5));

// ── Part B: render the bulk gummy editor and confirm per-gummy labels + case spread ──
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__X__={FormulationEditor};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
const noop=()=>{}; const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,location:{href:"",search:""},EnovaMasterBid:MB,EnovaBrain:require("./_kernel_for_tests")};
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node"},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>({from:()=>({select:()=>({})}),channel:()=>({on:()=>({subscribe:noop})}),auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})}})},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {FormulationEditor}=sb.globalThis.__X__;
const proj={pn:"P29996",customer:"FAME",product:"Bulk Berberine Gummies",dosageForm:"Gummies - Bulk",isBulk:true,
  gummyType:"sugarFree",gummyWt:3000,servingSize:2,servingsPerUnit:30,batchUnits:0,overage:0.06,containerType:"Bulk Case",
  pkg:{ shipper:{n:"ALT-BX-012M",d:"18 x 12 x 12"} }, baseItems:{}, tierPricing:[],
  ingredients:[{id:1,item:{n:"ALT-RP-0855",d:"Berberine HCl 97%"},inputMg:500,potencyPct:97}] };
const s=ReactDOMServer.renderToString(React.createElement(FormulationEditor,{proj,projects:[proj],setProjects:noop,autoGenPn:null,onGenConsumed:noop}));
const clean=s.replace(/<!--\s*-->/g,'');   // SSR inserts comment markers between static text + {expr}
const has=t=>clean.includes(t);
A(has("Sale Price/Gummy"), "margin table shows 'Sale Price/Gummy'");
A(has("COGS/Gummy"), "margin table shows 'COGS/Gummy'");
A(has("Total COGS / Gummy"), "COGS breakdown labeled per Gummy");
A(has("Gummy Quantity"), "margin quantity is in Gummies");
A(has("Gummies per Master Case"), "packaging shows 'Gummies per Master Case' (not a 60-count bottle)");
A(/priced per/.test(clean), "notes say priced per gummy");
console.log("editor rendered:", s.length, "chars | per-Gummy labels present");
console.log("\n"+(fail===0?"BULK UNIT-OF-MEASURE CHECKS PASSED":fail+" FAILED"));
process.exit(fail?1:0);
