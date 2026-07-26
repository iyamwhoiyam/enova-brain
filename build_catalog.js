const fs=require("fs");
const mined=JSON.parse(fs.readFileSync("/root/_sourcing_mined.json","utf8"));
const norm=s=>String(s||"").toLowerCase().replace(/\s+/g," ").replace(/[®™]/g,"").trim();
const cat={};  // normname -> entry
function add(name, alt, costPerG, pot, n){
  const k=norm(name); if(!k||/place ?holder|^n\/?a$|^blend$/i.test(k)) return;
  const e=cat[k]=cat[k]||{name, alt:null, aliases:new Set(), costPerG:[], potencyPct:[], n:0};
  if(alt && !e.alt) e.alt=alt;
  if(name!==e.name) e.aliases.add(name);
  if(costPerG!=null) e.costPerG.push(costPerG);
  if(pot) e.potencyPct.push(pot);
  e.n += n||1;
}
mined.alts.forEach(e=>add(e.name, e.alt, e.costPerG, e.potencyPct, e.n));
mined.names.forEach(e=>add(e.name, null, e.costPerG, e.potencyPct, e.n));
const med=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
const catList=Object.values(cat).map(e=>({
  name:e.name, alt:e.alt||null,
  costPerG: med(e.costPerG),
  potencyPct: med(e.potencyPct)||null,
  aliases: [...e.aliases].slice(0,4),
  n:e.n
})).sort((a,b)=>b.n-a.n);
fs.writeFileSync("/root/_sourcing_catalog.json", JSON.stringify(catList));
console.log("catalog entries:",catList.length," (unique ingredients across all sheets)");
console.log("with a cost:",catList.filter(e=>e.costPerG!=null).length," | with an RM#:",catList.filter(e=>e.alt).length);
console.log("\ntop 12 by frequency:");
catList.slice(0,12).forEach(e=>console.log("  ×"+String(e.n).padStart(3)+"  "+String(e.alt||"(no SKU)").padEnd(16)+" $/g="+(e.costPerG!=null?e.costPerG.toFixed(4):"  —  ")+"  "+e.name.slice(0,38)));
