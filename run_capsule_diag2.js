// Faithful re-diagnosis: model the capsule EXACTLY as the app would — real CONTAINER_TYPES['Bottle']
// slots (container/closure/label/desiccant/tamper/shipper), desiccant+tamper populated.
const B = require("./enova_brain.js");
const INV = {
  "ALT-RP-0076":{u:8.75/1000}, "ALT-RP-0781":{u:10/1000}, "ALT-RP-1070":{u:217/1000},
  "ALT-RP-1604":{u:180/1000}, "ALT-RP-0461":{u:68/1000}, "ALT-RP-0611":{u:85/1000},
  "SHELL":{u:0.0063}, "BTL":{u:0.21485}, "CAP":{u:0.0467}, "LBL":{u:0.15},
  "DES":{u:0.03}, "TE":{u:0.03}, "SHIP":{u:1.73},
};
const ING=[["ALT-RP-0076",47.5],["ALT-RP-0781",750],["ALT-RP-1070",300],["ALT-RP-1604",100],["ALT-RP-0461",10],["ALT-RP-0611",10]];
// Real Bottle slots from CONTAINER_TYPES
const BOTTLE_PKG = [{k:'container'},{k:'closure'},{k:'label'},{k:'desiccant'},{k:'tamper'},{k:'shipper'}];
function proj(overage, labelCost){
  INV.LBL.u = labelCost;
  return { pn:"RD07825-4", dosageForm:"Capsules", isBulk:false, overage,
    servingSize:2, servingsPerUnit:30, unitsPerContainer:60, batchUnits:5000, materialLoss:0.02, overheadPct:0.15,
    ingredients: ING.map(([a,mg])=>({importedAlt:a,inputMg:mg,potencyPct:100,item:{n:a}})),
    shellItem:{n:"SHELL"},
    pkg:{ container:{n:"BTL"}, closure:{n:"CAP"}, label:{n:"LBL"}, desiccant:{n:"DES"}, tamper:{n:"TE"}, shipper:{n:"SHIP"} },
  };
}
function ctx(){ return { invIx:INV, container:"Bottle",
  ctInfo:{ bulk:false, pkg:BOTTLE_PKG },
  cfg:{ gummy:false, shell:true, bulk:false, laborDefault:0.5, moq:5000 },
  unitNounForForm:"Capsule", mbForm:"capsule", masterBid:null, casePack:75,
  constants:{ label:0.15, stickpack:0.15, stickDisplay:1.00 } }; }
const G_PKG = 0.21485+0.0467+0.15+0.03+0.03+(1.73/75);  // 0.49462
const f=x=>"$"+Number(x).toFixed(5);
console.log("golden packaging (real slots):", f(G_PKG), " golden material COGS: $3.64841");
for (const ov of [0,0.03]) {
  const r=B.cost(proj(ov,0.15),ctx()).breakdown;
  console.log(`\noverage=${ov}: blend ${f(r.activeCPU)} | shells ${f(r.shellCPU)} | pkg ${f(r.pkgCPU)} | materials ${f(r.materialsCPU)}  (Δ vs 3.64841 = ${f(r.materialsCPU-3.64841)})`);
}
// Label-pin probe: set the label SKU to $0.25 and see whether cost uses 0.25 (correct) or 0.15 (pinned bug)
const rp = B.cost(proj(0,0.25),ctx()).breakdown;
console.log(`\nLABEL PIN PROBE — label SKU set to $0.25:  pkgCPU ${f(rp.pkgCPU)}  (if it ignores the $0.10 rise, label is pinned to $0.15)`);
