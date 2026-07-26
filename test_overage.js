const fs=require("fs"); const html=fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")),"utf8");
// slice docIngredientRows (module-level; now honors per-row overage)
function sliceFn(name){ const s=html.indexOf("function "+name+"("); let i=html.indexOf("{",s),d=0,e=-1;
  for(;i<html.length;i++){ if(html[i]==="{")d++; else if(html[i]==="}"){d--; if(d===0){e=i+1;break;}} } return html.slice(s,e); }
const INV_IX={ "ALT-RP-0001":{n:"ALT-RP-0001",d:"Test Active",u:0.02,q:100} };
// docIngredientRows now delegates the batch basis to docBatchBasis — slice both into scope.
const docIngredientRows=new Function("INV_IX", sliceFn("docBatchBasis")+"\n"+sliceFn("docIngredientRows")+"\n;return docIngredientRows;")(INV_IX);

const base={ servingsPerUnit:30, batchUnits:1000, overage:0.03,
  ingredients:[{ item:{n:"ALT-RP-0001"}, inputMg:1000, potencyPct:100 }] };
let fail=0; const A=(c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };

// 1) default overage: row has no override → uses proj.overage (0.03) → mgPS=1030
const d=docIngredientRows(base)[0];
console.log("default (proj 3%): mgPS =", d.mgPS.toFixed(3), "(expect 1030.000)");
A(Math.abs(d.mgPS-1030)<0.001, "default overage preserved (1030)");

// 2) per-row override 10% → mgPS=1100, project default untouched
const ov=docIngredientRows({ ...base, ingredients:[{ ...base.ingredients[0], overage:0.10 }] })[0];
console.log("row override 10%: mgPS =", ov.mgPS.toFixed(3), "(expect 1100.000)");
A(Math.abs(ov.mgPS-1100)<0.001, "per-row override applied (1100)");

// 3) override 0 → no overage → mgPS=1000
const z=docIngredientRows({ ...base, ingredients:[{ ...base.ingredients[0], overage:0 }] })[0];
console.log("row override 0%: mgPS =", z.mgPS.toFixed(3), "(expect 1000.000)");
A(Math.abs(z.mgPS-1000)<0.001, "0% override honored (1000)");

// 4) potency 50% doubles mgPS: 1000*1.03/0.5 = 2060
const p=docIngredientRows({ ...base, ingredients:[{ ...base.ingredients[0], potencyPct:50 }] })[0];
A(Math.abs(p.mgPS-2060)<0.001, "potency still applies with overage (2060), got "+p.mgPS.toFixed(3));

console.log("\n"+(fail===0?"ALL OVERAGE MATH PASSED":fail+" FAILED"));
process.exit(fail?1:0);
