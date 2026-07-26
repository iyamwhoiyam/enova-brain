const fs=require("fs"); const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")),"utf8");
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__X__={FormulationEditor,emptyProject};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;
const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const noop=()=>{}; const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,location:{href:"",search:""},EnovaBrain:require("./_kernel_for_tests")};
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node"},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>({from:()=>({select:()=>({})}),channel:()=>({on:()=>({subscribe:noop})}),auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})}})},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {FormulationEditor,emptyProject}=sb.globalThis.__X__;
const p=emptyProject("P29997"); p.dosageForm="Capsules"; p.servingsPerUnit=30;
p.ingredients=[
  {id:1,item:{n:"ALT-RP-0001",d:"Vitamin C"},inputMg:500,potencyPct:100},
  {id:2,item:{n:"ALT-RP-0002",d:"Zinc"},inputMg:15,potencyPct:20,overage:0.08},  // per-row override
];
const s=ReactDOMServer.renderToString(React.createElement(FormulationEditor,{proj:p,projects:[p],setProjects:noop,autoGenPn:null,onGenConsumed:noop}));
const has=t=>s.includes(t);
let fail=0; const A=(c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };
A(has("Overage %"), "main table shows an Overage % header");
A(has("Default Overage %"), "form field relabeled to Default Overage %");
A(!has("As Written"), "no 'As Written' anywhere");
// override row should show 8.00 (0.08*100); default row shows 3.00
A(s.includes('value="8"')||s.includes('value="8.00"')||/value="8(\.0+)?"/.test(s), "override row shows 8% overage");
console.log("editor render:",s.length,"chars | Overage col:",has("Overage %"),"| Default field:",has("Default Overage %"),"| As Written gone:",!has("As Written"));
console.log("\n"+(fail===0?"RENDER CHECKS PASSED":fail+" FAILED"));
process.exit(fail?1:0);
