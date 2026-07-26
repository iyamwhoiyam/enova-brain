const fs=require("fs"); const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")),"utf8");
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__X__={FIntakePanel};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;

// Patch useState BEFORE the module destructures { useState } = React.
const realUse=React.useState; let dS=false,dE=false,dM=false;
const noop=()=>{};
const ext={dosageForm:"Powder",customerName:"Test Co",productName:"Preworkout",servingSize:1,servingsPerUnit:30,batchQuantity:null,ingredients:[],formulationNotes:null};
const matches=[
  {name:"L-Citrulline DL-Malate (1:1)",mg:1500,potencyPct:100,overage:0.05,match:{item:{n:"ALT-RP-1901",d:"L-Citrulline Malate 1:1"},conf:0.9}},
  {name:"Coconut Water Powder",mg:600,potencyPct:100,overage:0.05,match:null},
];
React.useState=function(init){
  if(!dS&&init==="idle"){dS=true;return["done",noop];}
  if(!dE&&init===null){dE=true;return[ext,noop];}
  if(!dM&&Array.isArray(init)&&init.length===0){dM=true;return[matches,noop];}
  return realUse.call(this,init);
};
const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,location:{href:"",search:""}};
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node"},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>({from:()=>({select:()=>({})}),channel:()=>({on:()=>({subscribe:noop})}),auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})}})},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {FIntakePanel}=sb.globalThis.__X__;
const s=ReactDOMServer.renderToString(React.createElement(FIntakePanel,{onApply:noop,attachments:[],autoTrigger:false,autoText:"",onAutoDone:noop}));
React.useState=realUse;
const has=t=>s.includes(t);
let fail=0; const A=(c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };
A(has(">Ingredient<"), "header shows 'Ingredient'");
A(has("Potency %"), "header 'Potency %'");
A(has("Overage %"), "header 'Overage %'");
A(has("mg/serving"), "header 'mg/serving'");
A(!has("As Written"), "'As Written' removed");
A(has("L-Citrulline DL-Malate (1:1)"), "clean name in editable cell");
A(/value="1500"/.test(s), "mg 1500 editable");
A(/value="100"/.test(s), "potency 100 editable");
A(/value="5"/.test(s), "overage 5% editable");
A(has("Coconut Water Powder"), "second row name");
console.log("preview render:",s.length,"chars | done-state:",has("Apply to Formulation"));
["Ingredient","Potency %","Overage %","As Written"].forEach(h=>console.log("  "+h+":",has(h)?"present":"absent"));
console.log("\n"+(fail===0?"PREVIEW GRID CHECKS PASSED":fail+" FAILED"));
process.exit(fail?1:0);
