// Locks the data-integrity gate's decision core (validateProject, §25). A quote
// or MFSO sign is BLOCKED (errors) when COGS would be understated: no dose, an
// unmatched SKU, or a $0-cost matched SKU. A clean project passes (ok:true).
const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
function sliceFn(name){ const s=html.indexOf("function "+name+"("); let i=html.indexOf("{",s),d=0,e=-1;
  for(;i<html.length;i++){ if(html[i]==="{")d++; else if(html[i]==="}"){d--; if(d===0){e=i+1;break;}} } return html.slice(s,e); }

const INV_IX = {
  "ALT-RP-0001": { n:"ALT-RP-0001", d:"Vitamin C", u:0.02, q:100 },   // costed
  "ALT-RP-0009": { n:"ALT-RP-0009", d:"Zinc",      u:0,    q:50  },   // $0 cost
};
const validateProject = new Function("INV_IX", sliceFn("validateProject")+"\n;return validateProject;")(INV_IX);

let fail=0; const A=(c,m)=>{ if(!c){console.log("FAIL:",m);fail++;} };

// clean, costed, dosed → passes
const clean = { ingredients:[{item:{n:"ALT-RP-0001"},inputMg:500,potencyPct:100}],
  batchUnits:5000, servingsPerUnit:30, cogsBreakdown:{cogsPerUnit:2.13} };
const rClean = validateProject(clean);
A(rClean.ok === true && rClean.errors.length === 0, "clean project passes the gate, got "+JSON.stringify(rClean.errors));

// no dose → blocked
const noDose = { ingredients:[{item:{n:"ALT-RP-0001"},inputMg:0,potencyPct:100}], batchUnits:5000, servingsPerUnit:30 };
A(!validateProject(noDose).ok, "no-dose project is blocked");

// no SKU at all (dosed but never matched) → blocked as "not matched"
const unmatched = { ingredients:[{importedName:"Mystery Active",inputMg:500}], batchUnits:5000, servingsPerUnit:30 };
const rU = validateProject(unmatched);
A(!rU.ok && rU.errors.some(e=>/not matched/i.test(e)), "unmatched (no SKU) is blocked, got "+JSON.stringify(rU.errors));

// item object not in inventory (no cost) → blocked as uncosted (real app semantics)
const offBook = { ingredients:[{item:{n:"ALT-XX-9999"},inputMg:500}], batchUnits:5000, servingsPerUnit:30 };
const rO = validateProject(offBook);
A(!rO.ok && rO.errors.some(e=>/\$0\.00/.test(e)), "off-inventory SKU blocked as uncosted, got "+JSON.stringify(rO.errors));

// $0-cost matched SKU → blocked (this is the margin-protecting case)
const zeroCost = { ingredients:[{item:{n:"ALT-RP-0009"},inputMg:15}], batchUnits:5000, servingsPerUnit:30, cogsBreakdown:{cogsPerUnit:1} };
const rZ = validateProject(zeroCost);
A(!rZ.ok && rZ.errors.some(e=>/\$0\.00/.test(e)), "$0-cost SKU is blocked, got "+JSON.stringify(rZ.errors));

// warnings never block: costed+dosed but no batch qty → ok:true with a warning
const warnOnly = { ingredients:[{item:{n:"ALT-RP-0001"},inputMg:500}], servingsPerUnit:30, cogsBreakdown:{cogsPerUnit:2} };
const rW = validateProject(warnOnly);
A(rW.ok === true, "missing batch qty is a WARNING, not a block");
A(rW.warnings.some(w=>/batch quantity/i.test(w)), "batch-qty warning surfaced");

console.log(fail===0 ? "ALL INTEGRITY-GATE ASSERTIONS PASSED" : fail+" FAILED");
process.exit(fail?1:0);
