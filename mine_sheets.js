const fs=require("fs"),path=require("path");
const {XLSX, INV_IX}=require("/root/_load_app.js");
const DIRS=["/root/.claude/uploads/efc49f21-89af-55a6-99a7-80c24f9f07bc","/root/refs"];
const num=x=>{const n=Number(String(x==null?"":x).replace(/[^0-9.\-]/g,""));return isFinite(n)?n:0;};
function parseFormula(wb){
  const sh=wb.Sheets["MASTER FORMULA"];if(!sh)return null;
  const g=XLSX.utils.sheet_to_json(sh,{header:1,defval:""});
  const hr=g.findIndex(r=>/ingredient/i.test(String(r[0]))&&/rm#|rm #|item/i.test(String(r[1])));
  if(hr<0)return null;
  const H=g[hr].map(c=>String(c||"").replace(/\s+/g," ").trim());
  const col=re=>H.findIndex(h=>re.test(h));
  let cAmt=H.findIndex(h=>/^input\s*mg$/i.test(h)); if(cAmt<0)cAmt=col(/mg input per serving/i); if(cAmt<0)cAmt=col(/input,?\s*mg/i);
  let cCost=col(/^cost\b/i);
  const cPot=col(/potency/i);
  const rows=[];
  for(let i=hr+1;i<g.length;i++){const r=g[i],name=String(r[0]||"").trim();
    if(!name){if(rows.length>2)break;else continue;}
    if(/^(total|semi-?finished|finished good|blend\b)/i.test(name))break;
    const alt=String(r[1]||"").trim().toUpperCase();
    const mg=cAmt>=0?num(r[cAmt]):0; const lc=cCost>=0?num(r[cCost]):0;
    const pot=cPot>=0?num(r[cPot]):0;
    rows.push({name,alt:/^ALT-/.test(alt)?alt:null, mg, lineCost:lc, potencyPct: pot>1?pot:(pot>0?pot*100:100), costPerG:(lc>0&&mg>0)?lc/(mg/1000):null});
  }
  return rows;
}
// dedup by project (latest file)
const files=[]; for(const d of DIRS){ if(fs.existsSync(d)) fs.readdirSync(d).filter(f=>/\.xlsx$/i.test(f)).forEach(f=>files.push(path.join(d,f))); }
const byProj={}; files.forEach(fp=>{const b=path.basename(fp).replace(/^[0-9a-f]{8}-/,"");const m=b.match(/^(P\d+)/i);const k=m?m[1].toUpperCase():b;(byProj[k]=byProj[k]||[]).push(fp);});
const byAlt={}, byName={}; let nProj=0, nRows=0, parseFail=0;
for(const k of Object.keys(byProj)){
  const fp=byProj[k].sort().slice(-1)[0]; let wb,rows;
  try{wb=XLSX.readFile(fp);rows=parseFormula(wb);}catch(e){continue;}
  if(!rows){parseFail++;continue;} nProj++;
  for(const r of rows){ if(!r.name||/^\s*$/.test(r.name))continue; nRows++;
    if(r.alt){ const e=byAlt[r.alt]=byAlt[r.alt]||{alt:r.alt,names:{},costs:[],pots:[],projs:new Set()}; e.names[r.name]=(e.names[r.name]||0)+1; if(r.costPerG!=null)e.costs.push(r.costPerG); if(r.potencyPct)e.pots.push(r.potencyPct); e.projs.add(k); }
    else { const key=r.name.toLowerCase().replace(/\s+/g," ").trim(); const e=byName[key]=byName[key]||{name:r.name,costs:[],pots:[],projs:new Set()}; if(r.costPerG!=null)e.costs.push(r.costPerG); if(r.potencyPct)e.pots.push(r.potencyPct); e.projs.add(k); }
  }
}
const med=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const alts=Object.values(byAlt);
const inInv=alts.filter(e=>INV_IX[e.alt]).length;
const missing=alts.filter(e=>!INV_IX[e.alt]);
console.log("projects parsed:",nProj," rows:",nRows," parseFail:",parseFail);
console.log("unique RM# (ALT) codes across sheets:",alts.length);
console.log("  → already in embedded inventory:",inInv);
console.log("  → MISSING from inventory (coverage gap):",missing.length);
console.log("non-RM# ingredient names (sourcing candidates):",Object.keys(byName).length);
console.log("\n=== sample MISSING RM#s (would fail to price) ===");
missing.sort((a,b)=>b.projs.size-a.projs.size).slice(0,20).forEach(e=>{ const nm=Object.entries(e.names).sort((a,b)=>b[1]-a[1])[0][0]; console.log("  "+e.alt.padEnd(20)+" ×"+String(e.projs.size).padStart(3)+" projs  $/g="+(med(e.costs)!=null?med(e.costs).toFixed(5):"  —  ")+"  "+nm.slice(0,40)); });
console.log("\n=== sample non-RM# ingredients (need sourcing) ===");
Object.values(byName).sort((a,b)=>b.projs.size-a.projs.size).slice(0,15).forEach(e=>console.log("  ×"+String(e.projs.size).padStart(3)+"  $/g="+(med(e.costs)!=null?med(e.costs).toFixed(5):"  —  ")+"  "+e.name.slice(0,44)));
// write full catalog
const catalog={ generated:"mined", alts: alts.map(e=>({alt:e.alt, name:Object.entries(e.names).sort((a,b)=>b[1]-a[1])[0][0], costPerG:med(e.costs), potencyPct:med(e.pots), n:e.projs.size, inInv:!!INV_IX[e.alt]})),
  names: Object.values(byName).map(e=>({name:e.name, costPerG:med(e.costs), potencyPct:med(e.pots), n:e.projs.size})) };
fs.writeFileSync("/root/_sourcing_mined.json",JSON.stringify(catalog));
console.log("\nwrote _sourcing_mined.json — alts:"+catalog.alts.length+" names:"+catalog.names.length);
