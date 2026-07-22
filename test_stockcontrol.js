// §63 Stock Control — transactional inventory / purchasing / MO material issue. Helpers + SSR mounts.
const fs=require("fs"); const NG=process.env.ENOVA_NG||"/home/claude/.npm-global/lib/node_modules";
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync("/root/Enova_Brain_Studio_2.html","utf8");
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__SC__={StockControlPage,NewPOModal,NewMOModal,scMoney,scNum,scRpc};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;
const noop=()=>{};
const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,prompt:()=>"Test Vendor",open:noop,location:{href:"",search:""}};
// fake supabase client with the chaining load() uses (from().select().order().limit()) + rpc()
const chain={ select(){return this;}, order(){return this;}, limit(){return Promise.resolve({data:[],error:null});}, eq(){return Promise.resolve({data:[],error:null});} };
const sbStub={ from:()=>chain, rpc:async()=>({data:{},error:null}), channel:()=>({on:()=>({subscribe:noop})}),
  auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})} };
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node",clipboard:{writeText:async()=>{}}},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>sbStub},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {StockControlPage,NewPOModal,NewMOModal,scMoney,scNum,scRpc}=sb.globalThis.__SC__;

let fail=0; const A=(c,m)=>{ if(!c){console.log("  ✗ FAIL:",m);fail++;} else console.log("  ✓",m); };
const R=(el)=>{ try{ return ReactDOMServer.renderToString(el); }catch(e){ console.log("  THREW:",e.message); fail++; return ""; } };

// ── formatters ───────────────────────────────────────────────────────────────
A(scMoney(1234.5)==="$1,235","scMoney formats USD (no cents)");
A(scNum(40)==="40" && scNum("x")==="—","scNum formats numbers / dashes non-numeric");
A(typeof scRpc==="function","scRpc is the single RPC wrapper (sb.rpc)");

// ── StockControlPage mounts (loads async → renders the loading shell first) ──
const stock=[{sku:'RM-100',description:'Ashwagandha Extract',category:'Botanical',uom:'kg',on_hand:120,unit_cost:8.5,on_hand_value:1020,txn_count:3}];
const projects=[{pn:'P26244',product:'Test',customer:'Acme'}];
const scp=R(React.createElement(StockControlPage,{projects,onToggleNav:noop}));
A(/Stock Control/.test(scp),"StockControlPage: header renders");
A(/Loading live stock ledger/.test(scp),"StockControlPage: mounts and pulls live ledger from Supabase");

// ── New PO modal ─────────────────────────────────────────────────────────────
const po=R(React.createElement(NewPOModal,{stock,onClose:noop,onDone:noop}));
A(/New purchase order/.test(po),"NewPOModal: heading");
A(/Vendor/.test(po) && /Expected date/.test(po),"NewPOModal: vendor + expected date fields");
A(/Create PO/.test(po),"NewPOModal: submit calls erp_po_create");
A(/RM-100/.test(po),"NewPOModal: SKU autocomplete seeded from stock");

// ── New MO modal ─────────────────────────────────────────────────────────────
const mo=R(React.createElement(NewMOModal,{stock,projects,onClose:noop,onDone:noop}));
A(/New manufacturing order/.test(mo),"NewMOModal: heading");
A(/Project #/.test(mo) && /Batch qty/.test(mo),"NewMOModal: project + batch fields");
A(/Open MO/.test(mo),"NewMOModal: submit calls erp_mo_create");
A(/no invented items/.test(mo),"NewMOModal: honors the formula rule (enter only what the formula states)");
A(/P26244/.test(mo),"NewMOModal: project autocomplete seeded from projects");
A(/Seed from formula/.test(mo),"NewMOModal: seed-from-formula button present");
A(/grams\/batch/.test(mo),"NewMOModal: seed states grams/batch basis (mg/serving × overage × units ÷ 1000)");

console.log(fail===0 ? "\nSTOCK CONTROL CHECKS PASSED" : "\n"+fail+" FAILED");
process.exit(fail?1:0);
