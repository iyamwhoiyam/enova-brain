const B=require("./enova_brain.js");
const INV={ "ALT-RP-0076":{u:8.75/1000},"ALT-RP-0781":{u:10/1000},"ALT-RP-1070":{u:217/1000},
 "ALT-RP-1604":{u:180/1000},"ALT-RP-0461":{u:68/1000},"ALT-RP-0611":{u:85/1000},
 "SHELL":{u:0.0063},"BTL":{u:0.21485},"CAP":{u:0.0467},"LBL":{u:0.15},"DES":{u:0.03},"TE":{u:0.03},"SHIP":{u:1.73} };
// [alt, claim(colG), dosed(colI)]
const ING=[["ALT-RP-0076",45,47.5],["ALT-RP-0781",750,750],["ALT-RP-1070",300,300],["ALT-RP-1604",100,100],["ALT-RP-0461",10,10],["ALT-RP-0611",10,10]];
const BOTTLE=[{k:'container'},{k:'closure'},{k:'label'},{k:'desiccant'},{k:'tamper'},{k:'shipper'}];
function proj(mode){ return { pn:"RD07825-4",dosageForm:"Capsules",isBulk:false,overage:0.03,
 servingSize:2,servingsPerUnit:30,unitsPerContainer:60,batchUnits:5000,materialLoss:0.02,overheadPct:0.15,
 ingredients: ING.map(([a,claim,dosed])=>({ importedAlt:a, inputMg:claim, dosedMg: mode==='dosed'?dosed:null, potencyPct:100, item:{n:a} })),
 shellItem:{n:"SHELL"}, pkg:{container:{n:"BTL"},closure:{n:"CAP"},label:{n:"LBL"},desiccant:{n:"DES"},tamper:{n:"TE"},shipper:{n:"SHIP"}} }; }
function ctx(){ return { invIx:INV, container:"Bottle", ctInfo:{bulk:false,pkg:BOTTLE},
 cfg:{gummy:false,shell:true,bulk:false,laborDefault:0.5,moq:5000}, unitNounForForm:"Capsule", mbForm:"capsule",
 masterBid:null, casePack:75, constants:{label:0.15,stickpack:0.15,stickDisplay:1.00} }; }
const f=x=>"$"+Number(x).toFixed(5);
for(const mode of ['dosed','claim']){
  const b=B.cost(proj(mode),ctx()).breakdown;
  console.log(`\n[${mode==='dosed'?'dosedMg = col I (total used)':'claim fallback = col G, overage 0'}]`);
  console.log("  blend", f(b.activeCPU), "(golden $2.77637)  Δ", f(b.activeCPU-2.77637));
  console.log("  materials", f(b.materialsCPU), "(golden $3.64841)  Δ", f(b.materialsCPU-3.64841));
}
