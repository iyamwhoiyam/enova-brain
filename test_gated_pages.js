const fs=require("fs"); const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")),"utf8");
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__X__={QuotePage,DocumentsPage,GeneratePage};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;
const noop=()=>{};
// seed the FIRST useState(null) (pn) in whichever page we render
let seedPn=null, done=false;
const realUse=React.useState;
React.useState=function(init){ if(!done && init===null && seedPn){ done=true; return [seedPn, noop]; } return realUse.call(this,init); };
const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,location:{href:"",search:""}};
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node"},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>({from:()=>({select:()=>({})}),channel:()=>({on:()=>({subscribe:noop})}),auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})}})},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {QuotePage,DocumentsPage,GeneratePage}=sb.globalThis.__X__;
// project with a $0-cost (off-book) ingredient → readiness error
const proj={pn:"P29990",customer:"Test Co",product:"Test",dosageForm:"Capsules",isBulk:false,servingSize:2,servingsPerUnit:30,batchUnits:5000,overage:0.03,
  ingredients:[{id:1,item:{n:"ALT-XX-9999",d:"Off-book Active"},inputMg:500,potencyPct:100}],pkg:{},baseItems:{},tierPricing:[],revision:1,stage:"BID Process"};
let fail=0; const A=(c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };
function render(name,Comp){ seedPn="P29990"; done=false;
  let s; try{ s=ReactDOMServer.renderToString(React.createElement(Comp,{projects:[proj],setProjects:noop,onToggleNav:noop})); }
  catch(e){ console.log("  "+name+": THREW "+e.message); fail++; return ""; }
  console.log("  "+name+": OK ("+s.length+" chars)"); return s; }
const q=render("QuotePage",QuotePage);
A(/understated/i.test(q), "Quote shows the understated-cost readiness banner");
const d=render("DocumentsPage",DocumentsPage);
A(/COGS understated|Data readiness/i.test(d), "Documents shows readiness error");
render("GeneratePage",GeneratePage);
React.useState=realUse;
console.log(fail===0?"\nGATED PAGES RENDER OK":"\n"+fail+" FAILED");
process.exit(fail?1:0);
