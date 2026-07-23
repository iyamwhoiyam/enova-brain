// §66 Audit & Traceability — binder generation + SSR mount.
const fs=require("fs"); const NG=process.env.ENOVA_NG||"/home/claude/.npm-global/lib/node_modules";
const React=require(NG+"/react"), ReactDOMServer=require(NG+"/react-dom/server"), babel=require(NG+"/@babel/core");
const html=fs.readFileSync("/root/Enova_Brain_Studio_2.html","utf8");
const invData=(html.match(/<script id="inv-data"[^>]*>([\s\S]*?)<\/script>/)||[])[1]||"[]";
let code=html.match(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/)[1];
code=code.replace(/ReactDOM\.createRoot\([\s\S]*?\.render\(<Root\/>\);/,"/*strip*/");
code+="\n;globalThis.__A__={AuditTracePage,buildBinderHtml,atExportAuditCsv,atEsc};";
const out=babel.transformSync(code,{presets:[[NG+"/@babel/preset-react",{runtime:"classic"}]],filename:"a.jsx",sourceType:"script"}).code;
const noop=()=>{};
const fakeEl=t=>({textContent:t,addEventListener(){},removeEventListener(){},style:{},appendChild(){},setAttribute(){}});
const doc={getElementById:id=>id==="inv-data"?fakeEl(invData):fakeEl("{}"),createElement:()=>fakeEl(""),body:fakeEl(""),addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
const win={addEventListener:noop,removeEventListener:noop,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop}),localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},alert:noop,confirm:()=>true,open:()=>({document:{write:noop,close:noop}}),location:{href:"",search:""}};
const chain={data:[],error:null}; ["select","order","eq","ilike","limit","gte","lte"].forEach(m=>chain[m]=()=>chain); chain.then=(res)=>res({data:[],error:null});
const sbStub={ from:()=>chain, rpc:async()=>({data:{},error:null}), storage:{from:()=>({createSignedUrl:async()=>({data:{},error:null})})}, channel:()=>({on:()=>({subscribe:noop})}), auth:{getSession:async()=>({data:{}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe:noop}}})} };
const sb={React,ReactDOM:{createPortal:c=>c,createRoot:()=>({render:noop})},ReactDOMServer,document:doc,window:win,navigator:{userAgent:"node",clipboard:{writeText:async()=>{}}},localStorage:win.localStorage,XLSX:{utils:{},read:()=>({}),write:()=>""},mammoth:{},Decimal:require(NG+"/decimal.js"),supabase:{createClient:()=>sbStub},console,setTimeout,clearTimeout,setInterval,clearInterval,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,Map,Set,Symbol,isNaN,parseFloat,parseInt,globalThis:{}};
sb.globalThis=sb; sb.self=sb; const vm=require("vm"); vm.createContext(sb); vm.runInContext(out,sb,{filename:"a.js"});
const {AuditTracePage,buildBinderHtml,atExportAuditCsv,atEsc}=sb.globalThis.__A__;

let fail=0; const A=(c,m)=>{ if(!c){console.log("  ✗ FAIL:",m);fail++;} else console.log("  ✓",m); };
const R=(el)=>{ try{ return ReactDOMServer.renderToString(el); }catch(e){ console.log("  THREW:",e.message); fail++; return ""; } };

A(atEsc('<a>&"')==='&lt;a&gt;&amp;&quot;',"atEsc escapes HTML (safe binder output)");
A(typeof atExportAuditCsv==='function',"CSV export helper present");

// buildBinderHtml — only EFFECTIVE docs count; trail included
const bin=buildBinderHtml('P26244',{customer:'Acme',product:'Berberine'},
  [{doc_type:'coa',title:'Berberine COA',revision:2,status:'effective',effective_date:'2026-07-23',approver:'jb@e.com',sha256:'abcdef0123456789zz'},
   {doc_type:'label',title:'Label',status:'draft'}],
  [{created_at:'2026-07-23T10:00:00Z',actor_email:'jb@e.com',action:'doc.register',detail:'coa rev 2'}]);
A(/Project Audit Binder/.test(bin) && /P26244/.test(bin) && /Acme/.test(bin),"binder: project header");
A(/Effective controlled documents \(1\)/.test(bin),"binder: counts only EFFECTIVE docs (draft excluded)");
A(/Berberine COA/.test(bin) && /abcdef0123456789/.test(bin),"binder: doc row incl sha-256");
A(/Audit trail \(1 events · hash-chained/.test(bin) && /doc\.register/.test(bin),"binder: hash-chained audit trail included");
A(/window\.print\(\)/.test(bin),"binder: printable (Print / Save as PDF)");

// AuditTracePage mounts
const projects=[{pn:'P26244',product:'Berberine',customer:'Acme'}];
const ap=R(React.createElement(AuditTracePage,{projects,onToggleNav:noop}));
A(/Audit &(amp;|#x26;| ) ?Traceability|Audit &amp; Traceability|Audit & Traceability/.test(ap) || /Traceability/.test(ap),"AuditTracePage: header renders");
A(/Loading the audit trail/.test(ap),"AuditTracePage: mounts + loads studio_audit");

console.log(fail===0 ? "\nAUDIT & TRACEABILITY CHECKS PASSED" : "\n"+fail+" FAILED");
process.exit(fail?1:0);
