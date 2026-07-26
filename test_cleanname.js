const fs=require("fs"); const html=fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")),"utf8");
const s=html.indexOf("function cleanIngName("); let i=html.indexOf("{",s),d=0,e=-1;
for(;i<html.length;i++){ if(html[i]==="{")d++; else if(html[i]==="}"){d--; if(d===0){e=i+1;break;}} }
const cleanIngName=eval("("+html.slice(s,e).replace("function cleanIngName","function")+")");
const cases=[
 ["Vitamin C (as Ascorbic Acid) 60mg 72mg (20%) AOAC 967.22 60","Vitamin C (as Ascorbic Acid)"],
 ["Vitamin B6 (as Pyridoxine Hydrochloride) 0.6mg 0.70mg (17%) AOAC 694.15 0.60","Vitamin B6 (as Pyridoxine Hydrochloride)"],
 ["L-Leucine 3.5g 3.96g (13%) HPLC 3.5","L-Leucine"],
 ["L-Citrulline DL-Malate (1:1) 1.5g 1.53 (2%) * 1.5","L-Citrulline DL-Malate (1:1)"],
 ["Glycine 1g 1.05g (5%) * 1","Glycine"],
 ["Taurine 1g 1.02 (2%) * 1","Taurine"],
 ["Coconut Water Powder 500mg 525mg (5%) * 500","Coconut Water Powder"],
 ["N-Acetyl L-Cysteine 100mg 102mg (2%) * 100","N-Acetyl L-Cysteine"],
 ["Magnesium Citrate 30%","Magnesium Citrate"],
 ["Zinc (L-Monomethionine and Zinc Aspartate) 20% TM","Zinc (L-Monomethionine and Zinc Aspartate)"],
 ["5-HTP","5-HTP"],
 ["KSM-66(R) Ashwagandha","KSM-66(R) Ashwagandha"],
 ["Rhodiola Rosea Extract (3% rosavins)","Rhodiola Rosea Extract (3% rosavins)"],
 ["Matcha Green Tea Powder (Organic)","Matcha Green Tea Powder (Organic)"],
 ["L-tyrosine","L-tyrosine"],
 ["Magnesium Citrate","Magnesium Citrate"],
];
let fail=0;
cases.forEach(([inp,exp])=>{ const got=cleanIngName(inp); const ok=got===exp; if(!ok){fail++;} console.log((ok?"ok  ":"FAIL")+" | "+JSON.stringify(got)+(ok?"":"   expected "+JSON.stringify(exp))); });
console.log("\n"+(fail===0?"ALL NAME CASES PASS":fail+" FAILED"));
process.exit(fail?1:0);
