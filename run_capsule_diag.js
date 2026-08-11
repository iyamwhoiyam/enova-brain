// Diagnostic: run the app kernel on the RadiantGlow / Resveratrol 60ct capsule with the GOLDEN
// worksheet prices, and compare COGS to the golden worksheet ($3.64841 material COGS).
const B = require("./enova_brain.js");

// GOLDEN inventory prices: ingredients as $/g (worksheet $/kg ÷ 1000), packaging as $/each.
const INV = {
  "ALT-RP-0076": { u: 8.75/1000, n:"ALT-RP-0076" },  // Vitamin C
  "ALT-RP-0781": { u: 10/1000,   n:"ALT-RP-0781" },  // Collagen
  "ALT-RP-1070": { u: 217/1000,  n:"ALT-RP-1070" },  // Resveratrol
  "ALT-RP-1604": { u: 180/1000,  n:"ALT-RP-1604" },  // Sodium Hyaluronate
  "ALT-RP-0461": { u: 68/1000,   n:"ALT-RP-0461" },  // ALA
  "ALT-RP-0611": { u: 85/1000,   n:"ALT-RP-0611" },  // Quercetin
  "SHELL":  { u: 0.0063,  n:"SHELL"  },
  "BTL":    { u: 0.21485, n:"BTL"    },  // 200cc 38/400 PETE
  "CAP":    { u: 0.0467,  n:"CAP"    },  // 38/400 closure
  "LBL":    { u: 0.15,    n:"LBL"    },
  "SHIP":   { u: 1.73,    n:"SHIP"   },  // master case, 75 btls/box
};
// per-serving inputs straight from the worksheet "Input Per Serving" column
const ING = [
  ["ALT-RP-0076", 47.5], ["ALT-RP-0781", 750], ["ALT-RP-1070", 300],
  ["ALT-RP-1604", 100], ["ALT-RP-0461", 10], ["ALT-RP-0611", 10],
];
function proj(overage){
  return { pn:"RD07825-4", dosageForm:"Capsules", isBulk:false, overage,
    servingSize:2, servingsPerUnit:30, unitsPerContainer:60, batchUnits:5000,
    materialLoss:0.02, overheadPct:0.15,
    ingredients: ING.map(([a,mg])=>({ importedAlt:a, inputMg:mg, potencyPct:100, item:{n:a} })),
    shellItem:{ n:"SHELL" },
    pkg:{ container:{n:"BTL"}, closure:{n:"CAP"}, label:{n:"LBL"}, shipper:{n:"SHIP"} },
  };
}
function ctx(){
  return { invIx: INV, container:"Bottle",
    ctInfo:{ bulk:false, pkg:[{k:"container"},{k:"closure"},{k:"label"},{k:"shipper"}] },
    cfg:{ gummy:false, shell:true, bulk:false, laborDefault:0.5, moq:5000 },
    unitNounForForm:"Capsule", mbForm:"capsule", masterBid:null,
    casePack:75, constants:{ label:0.15, stickpack:0.15, stickDisplay:1.00 },
  };
}
const G = { blend:2.77637, shells:0.378, container:0.21485, closure:0.0467, label:0.15,
            desiccant:0.03, neckband:0.03, shipper:1.73/75, fgCOGS:3.64841 };
const f=(x)=> (x==null?"—":("$"+Number(x).toFixed(5)));

for (const ov of [0, 0.03]) {
  const r = B.cost(proj(ov), ctx());
  const b = r.breakdown, v = r.view;
  console.log(`\n===== APP KERNEL (overage=${ov}) =====`);
  console.log("blend/actives CPU :", f(b.activeCPU), " golden", f(G.blend), " Δ", f(b.activeCPU-G.blend));
  console.log("shells CPU        :", f(b.shellCPU),  " golden", f(G.shells), " Δ", f(b.shellCPU-G.shells));
  console.log("packaging CPU     :", f(b.pkgCPU),    " (app: container+closure+label(pinned)+shipper/casePack)");
  console.log("   golden packaging:", f(G.container+G.closure+G.label+G.desiccant+G.neckband+G.shipper),
              "= cont",f(G.container),"clo",f(G.closure),"lbl",f(G.label),"desicc",f(G.desiccant),"neck",f(G.neckband),"ship",f(G.shipper));
  console.log("materials CPU     :", f(b.materialsCPU), " golden FG COGS", f(G.fgCOGS), " Δ", f(b.materialsCPU-G.fgCOGS));
  console.log("labor/unit        :", f(b.laborPerUnit), " overhead CPU", f(b.overheadCPU), " source", b.source);
  console.log("COGS/unit (w/ L+OH):", f(b.cogsPerUnit));
}
