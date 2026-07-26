// §38 — stick-pack packaging correctness + per-project cost override.
//   (1) A stick pack can NEVER be a bottle/canister: coerceContainerForForm forces the Stick-Pack
//       Box (foil + display + shipper) even when a stale bottle/canister containerType is present.
//   (2) skuCostFor honors a per-project manual cost override, falling back to the live MISys cost.
const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };

function sliceFn(name){ const s=html.indexOf("function "+name+"("); let i=html.indexOf("{",s),d=0,e=-1;
  for(;i<html.length;i++){ if(html[i]==="{")d++; else if(html[i]==="}"){d--; if(d===0){e=i+1;break;}} } return html.slice(s,e); }

const CONTAINER_TYPES = {
  'Bottle':        { bulk:false, pkg:[{k:'container'},{k:'closure'},{k:'label'},{k:'shipper'}] },
  'Canister / Tub':{ bulk:false, pkg:[{k:'container'},{k:'closure'},{k:'label'},{k:'scoop'},{k:'tamper'},{k:'shipper'}] },
  'Stick-Pack Box':{ bulk:false, pkg:[{k:'foil'},{k:'display'},{k:'shipper'}] },
  'Bulk Case':     { bulk:true,  pkg:[{k:'shipper'}] },
};
const INV_IX = { 'ALT-RP-0003':{ n:'ALT-RP-0003', u:0.00429 }, 'ALT-BT-1104':{ n:'ALT-BT-1104', u:0.60 } };
const body = [ sliceFn("defaultContainerFor"), sliceFn("coerceContainerForForm"), sliceFn("skuCostFor"),
  "return { defaultContainerFor, coerceContainerForForm, skuCostFor };" ].join("\n");
const M = new Function("CONTAINER_TYPES","INV_IX", body)(CONTAINER_TYPES, INV_IX);

// ── (1) container coercion ──
A(M.coerceContainerForForm({ dosageForm:'Stickpacks' }) === 'Stick-Pack Box', "fresh stick pack → Stick-Pack Box");
A(M.coerceContainerForForm({ dosageForm:'Stickpacks', containerType:'Canister / Tub' }) === 'Stick-Pack Box',
  "stick pack with a STALE canister container → coerced to Stick-Pack Box (never a canister/bottle)");
A(M.coerceContainerForForm({ dosageForm:'Stickpacks', containerType:'Bottle' }) === 'Stick-Pack Box',
  "stick pack with a stale bottle container → coerced to Stick-Pack Box");
A(M.coerceContainerForForm({ dosageForm:'Stickpacks', isBulk:true }) === 'Bulk Case', "bulk stick pack → Bulk Case");
A(M.coerceContainerForForm({ dosageForm:'Stickpacks', containerType:'Stick-Pack Box' }) === 'Stick-Pack Box',
  "stick pack that already has the stick box → kept");
// other forms honor the user's explicit container
A(M.coerceContainerForForm({ dosageForm:'Powder', containerType:'Canister / Tub' }) === 'Canister / Tub',
  "powder honors an explicit canister choice (not coerced)");
A(M.coerceContainerForForm({ dosageForm:'Capsules' }) === 'Bottle', "capsule default is Bottle");
// the coerced stick container has NO bottle/closure/scoop slots
const stickSlots = CONTAINER_TYPES[M.coerceContainerForForm({ dosageForm:'Stickpacks', containerType:'Canister / Tub' })].pkg.map(s=>s.k);
A(stickSlots.join(',')==='foil,display,shipper', "coerced stick slots = foil/display/shipper only (no container/closure/scoop): "+stickSlots.join(','));

// ── (2) per-project cost override ──
A(M.skuCostFor('ALT-RP-0003', {}) === 0.00429, "skuCostFor returns the live MISys cost when no override");
A(M.skuCostFor('ALT-RP-0003', { costOverride:{ 'ALT-RP-0003': 0.0090 } }) === 0.0090, "skuCostFor honors a per-project override");
A(M.skuCostFor('ALT-RP-0003', { costOverride:{ 'ALT-OTHER': 1 } }) === 0.00429, "override for a different SKU doesn't affect this one");
A(M.skuCostFor('ALT-UNKNOWN', {}) === null, "unknown SKU → null (no cost)");
A(M.skuCostFor('ALT-UNKNOWN', { costOverride:{ 'ALT-UNKNOWN': 0.5 } }) === 0.5, "override works even for an off-MISys line");
A(M.skuCostFor('ALT-RP-0003', { costOverride:{ 'ALT-RP-0003': 'x' } }) === 0.00429, "non-numeric override is ignored (falls back to MISys)");

console.log(fail === 0 ? "STICK-PACK PACKAGING + COST-OVERRIDE CHECKS PASSED" : fail + " FAILED");
process.exit(fail ? 1 : 0);
