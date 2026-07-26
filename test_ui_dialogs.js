// UI polish (§29) — guards the in-app toast + confirm-modal that replaced native alert()/confirm().
// Verifies: (a) the emitters fall back to window.alert/confirm when no host is mounted (so module-
// scope callers are always safe), (b) confirmDialog resolves the host's choice as a boolean, and
// (c) ToastHost/ConfirmHost render to nothing when idle (no stray DOM, no crash).
const fs=require("fs");
const NG=process.env.ENOVA_NG||require("path").join(__dirname,"node_modules");
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")),"utf8");
let fail=0; const A=(c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };

let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__X__={ToastHost,ConfirmHost,toast,confirmDialog};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;

const noop=()=>{}; const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:()=>fakeEl("[]"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
let alertCalls=0, confirmReturn=true;
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:(m)=>{alertCalls++;},confirm:()=>confirmReturn,location:{href:"",search:""}};
const sb={React,ReactDOM:{createPortal:(c)=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node"},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>({from:()=>({select:()=>({})}),channel:()=>({on:()=>({subscribe:noop})}),auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})}})},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,Promise,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {ToastHost,ConfirmHost,toast,confirmDialog}=sb.globalThis.__X__;

// (a) toast() with no host mounted → falls back to window.alert, never throws
alertCalls=0; toast("hello","warn");
A(alertCalls===1, "toast() falls back to window.alert when no host mounted");

// (b) confirmDialog() with no host → resolves window.confirm result as a boolean, both ways
(async()=>{
  confirmReturn=true;  const yes=await confirmDialog("proceed?");
  confirmReturn=false; const no =await confirmDialog({message:"proceed?",danger:true});
  A(yes===true,  "confirmDialog resolves TRUE from window.confirm fallback");
  A(no===false,  "confirmDialog resolves FALSE from window.confirm fallback");

  // (c) idle hosts render to nothing (return null) — no stray DOM, no crash
  const th=ReactDOMServer.renderToString(React.createElement(ToastHost));
  const ch=ReactDOMServer.renderToString(React.createElement(ConfirmHost));
  A(th==="" , "idle ToastHost renders nothing, got "+JSON.stringify(th).slice(0,40));
  A(ch==="" , "idle ConfirmHost renders nothing, got "+JSON.stringify(ch).slice(0,40));

  console.log("toast fallback + confirm resolve("+String(yes)+"/"+String(no)+") + idle hosts render null");
  console.log("\n"+(fail===0?"UI DIALOG CHECKS PASSED":fail+" FAILED"));
  process.exit(fail?1:0);
})();
