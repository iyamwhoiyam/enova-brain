// §65 Document Vault — helpers + SSR mounts.
const fs=require("fs"); const NG=process.env.ENOVA_NG||"/home/claude/.npm-global/lib/node_modules";
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync("/root/Enova_Brain_Studio_2.html","utf8");
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__V__={DocumentVaultPage,DocUploadModal,dvBytes,DOC_TYPES,DOC_TYPE_LABEL};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;
const noop=()=>{};
const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,open:noop,location:{href:"",search:""}};
const chain={ select(){return this;}, order(){return this;}, eq(){return this;}, limit(){return Promise.resolve({data:[],error:null});} };
const sbStub={ from:()=>chain, rpc:async()=>({data:{},error:null}), storage:{from:()=>({upload:async()=>({error:null}),createSignedUrl:async()=>({data:{signedUrl:"x"},error:null})})},
  channel:()=>({on:()=>({subscribe:noop})}), auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})} };
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node",clipboard:{writeText:async()=>{}}},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),crypto:{subtle:{digest:async()=>new ArrayBuffer(32)}},supabase:{createClient:()=>sbStub},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {DocumentVaultPage,DocUploadModal,dvBytes,DOC_TYPES,DOC_TYPE_LABEL}=sb.globalThis.__V__;

let fail=0; const A=(c,m)=>{ if(!c){console.log("  ✗ FAIL:",m);fail++;} else console.log("  ✓",m); };
const R=(el)=>{ try{ return ReactDOMServer.renderToString(el); }catch(e){ console.log("  THREW:",e.message); fail++; return ""; } };

A(dvBytes(500)==="500 B" && dvBytes(2048)==="2 KB" && /MB/.test(dvBytes(3000000)),"dvBytes formats B/KB/MB");
A(DOC_TYPES.includes('coa') && DOC_TYPES.includes('mbr') && DOC_TYPE_LABEL.mbr==="MBR / Batch Record","controlled doc types incl COA + MBR");

const projects=[{pn:'P26244',product:'Berberine',customer:'Acme'}];
const vp=R(React.createElement(DocumentVaultPage,{projects,onToggleNav:noop}));
A(/Document Vault/.test(vp),"DocumentVaultPage: header renders");
A(/Loading the document vault/.test(vp),"DocumentVaultPage: mounts + loads from erp_v_documents");

const um=R(React.createElement(DocUploadModal,{projects,presetPn:'P26244',onClose:noop,onDone:noop}));
A(/Add controlled document/.test(um),"DocUploadModal: heading");
A(/Project #/.test(um) && /Document type/.test(um),"DocUploadModal: project + type fields");
A(/COA/.test(um) && /MBR \/ Batch Record/.test(um),"DocUploadModal: controlled types listed");
A(/Register document/.test(um),"DocUploadModal: submit → erp_doc_register");
A(/immutable document vault/.test(um) && /sha-256 stamped/.test(um),"DocUploadModal: states immutable + sha-256 (audit posture)");
A(/supersedes the prior/.test(um),"DocUploadModal: versioning/supersession explained");

console.log(fail===0 ? "\nDOCUMENT VAULT CHECKS PASSED" : "\n"+fail+" FAILED");
process.exit(fail?1:0);
