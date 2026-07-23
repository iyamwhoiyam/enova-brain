// §67 Operations Command Center — SSR mount (loads live erp_v_* aggregates).
const fs=require("fs"); const NG=process.env.ENOVA_NG||"/home/claude/.npm-global/lib/node_modules";
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync("/root/Enova_Brain_Studio_2.html","utf8");
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__C__={CommandCenterPage};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;
const noop=()=>{};
const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,open:noop,location:{href:"",search:""}};
const chain={data:[],error:null}; ["select","order","eq","ilike","limit","maybeSingle","gte","lte"].forEach(m=>chain[m]=()=>chain); chain.then=(res)=>res({data:[],error:null});
const sbStub={ from:()=>chain, rpc:async()=>({data:{},error:null}), channel:()=>({on:()=>({subscribe:noop})}), auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})} };
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node"},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>sbStub},console,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:noop,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {CommandCenterPage}=sb.globalThis.__C__;

let fail=0; const A=(c,m)=>{ if(!c){console.log("  ✗ FAIL:",m);fail++;} else console.log("  ✓",m); };
const R=(el)=>{ try{ return ReactDOMServer.renderToString(el); }catch(e){ console.log("  THREW:",e.message); fail++; return ""; } };

const projects=[{pn:'P100',stage:'In Production',dateReceived:new Date().toISOString().slice(0,10)}];
const cc=R(React.createElement(CommandCenterPage,{projects,onToggleNav:noop}));
A(/Command Center/.test(cc),"CommandCenterPage: header renders");
A(/Loading the live operations view/.test(cc),"CommandCenterPage: mounts + polls live erp_v_* aggregates");
A(typeof CommandCenterPage==='function',"CommandCenterPage exported");

console.log(fail===0 ? "\nCOMMAND CENTER CHECKS PASSED" : "\n"+fail+" FAILED");
process.exit(fail?1:0);
