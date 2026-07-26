const fs=require("fs");
const mined=JSON.parse(fs.readFileSync("/root/_sourcing_mined.json","utf8"));
const html=fs.readFileSync("/root/Enova_Brain_Studio_2.html","utf8");
const m=html.match(/(<script id="inv-data" type="application\/json">)([\s\S]*?)(<\/script>)/);
if(!m){console.log("inv-data tag not found");process.exit(1);}
const inv=JSON.parse(m[2]);
const have=new Set(inv.map(x=>x.n));
const PRE={RP:"Raw Material — Powder (sheet-sourced)",RL:"Raw Material — Liquid (sheet-sourced)",CA:"Cap / Closure (sheet-sourced)",BX:"Shipper / Box (sheet-sourced)",TE:"Tamper / Neckband (sheet-sourced)",BG:"Bag / Pouch (sheet-sourced)",BT:"Bottle / Jar (sheet-sourced)",LB:"Label (sheet-sourced)"};
const cat=alt=>{const mm=alt.match(/^ALT-([A-Z]{2})/);return (mm&&PRE[mm[1]])||"Component (sheet-sourced)";};
let added=0, priced=0;
for(const e of mined.alts){
  if(e.inInv || have.has(e.alt)) continue;
  const isWater=/water/i.test(e.name);
  const u = e.costPerG!=null ? Number(e.costPerG) : (isWater?0:null);
  inv.push({ n:e.alt, d:e.name, c:cat(e.alt), q:0, u:(u!=null?u:0), s:"sheet-mined", src:"sheet", pot:(e.potencyPct||null) });
  added++; if(e.costPerG!=null||isWater) priced++;
}
const out=html.slice(0,m.index)+m[1]+JSON.stringify(inv)+m[3]+html.slice(m.index+m[0].length);
fs.writeFileSync("/root/Enova_Brain_Studio_2.html",out);
console.log("inventory items:",inv.length," (added "+added+" missing RM#s from sheets; "+priced+" with a cost)");
