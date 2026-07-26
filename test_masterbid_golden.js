// GOLDEN LOCK for the EnovaMasterBid cost engine (§10). The labor + overhead
// figures at 5,000 units are the VALIDATED P26132 (Edibolts, Capsule-Bottle line)
// numbers — Direct Labor $533.2115, Mfg Overhead $828.00 — derived exactly from
// the engine formulas (pieces = 5000×1×30 = 150,000; blends = 1; warehouse floored
// at $300). The material-inclusive cost/unit uses a fixed dm_unit so the full
// DML→total composition and tier scaling are locked against silent drift. If any
// of these move, a formula changed — investigate before shipping.
const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");

// slice the self-contained EnovaMasterBid IIFE and instantiate it
const a = html.indexOf("(function(root){");
const endTok = "})(typeof self!=='undefined'?self:this);";
const b = html.indexOf(endTok, a) + endTok.length;
const src = html.slice(a, b);
const root = {};
new Function("self", "module", src + "\n;return self.EnovaMasterBid;")(root, undefined);
const MB = root.EnovaMasterBid;

let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (x, y, e = 1e-4) => Math.abs(x - y) <= e;

// P26132: 30-count tablet bottle on the Capsule-Bottle line, dm_unit fixed to a
// value that reproduces the documented $2.1292423/unit @ 5,000.
const inp = { form: "Capsule - Bottle", caps_per_serv: 1, servings: 30, blend_size: 0.027, base_qty: 1, loss: 0.02, dm_unit: 1.7875 };

const t5k = MB.build(MB.MB_DEFAULTS, inp, 5000, 0);
console.log("@5,000 →  labor $" + t5k.labor.toFixed(4), "| overhead $" + t5k.overhead.toFixed(2),
  "| blends " + t5k.blends, "| cost/unit $" + t5k.cost_per_unit.toFixed(7));
A(near(t5k.labor, 533.2115), "VALIDATED direct labor $533.2115 @5,000, got " + t5k.labor.toFixed(4));
A(near(t5k.overhead, 828.0, 1e-6), "VALIDATED mfg overhead $828.00 @5,000, got " + t5k.overhead.toFixed(4));
A(t5k.blends === 1, "1 blend @5,000, got " + t5k.blends);
A(near(t5k.cost_per_unit, 2.1292423, 1e-6), "cost/unit $2.1292423 @5,000, got " + t5k.cost_per_unit.toFixed(7));
// composition invariants
A(near(t5k.lines.pharm, 153) && near(t5k.lines.blend, 153), "pharmacy + blending $153 each @1 blend");
A(near(t5k.lines.encap, 51) && near(t5k.lines.inspect, 12.75), "encap $51 + inspect $12.75 at 150,000 pieces");
A(near(t5k.total, t5k.dml + t5k.labor + t5k.overhead), "total = DML + labor + overhead");

// Economy of scale: cost/unit must fall as quantity rises.
const t100k = MB.build(MB.MB_DEFAULTS, inp, 100000, 0);
console.log("@100,000 → labor $" + t100k.labor.toFixed(2), "| overhead $" + t100k.overhead.toFixed(2),
  "| blends " + t100k.blends, "| cost/unit $" + t100k.cost_per_unit.toFixed(7));
A(t100k.cost_per_unit < t5k.cost_per_unit, "cost/unit drops with volume (100k < 5k)");
A(t100k.blends === 2, "2 blends @100,000 (2,700 kg > 1,500 cap), got " + t100k.blends);
A(near(t100k.cost_per_unit, 1.9292473, 1e-6), "cost/unit @100,000 locked at $1.9292473, got " + t100k.cost_per_unit.toFixed(7));

// Margin math sanity at a sample price.
const priced = MB.build(MB.MB_DEFAULTS, inp, 5000, 3.50);
A(near(priced.revenue, 17500), "revenue = qty × price");
A(near(priced.margin, priced.revenue - priced.total), "margin = revenue − total");
A(priced.margin_pct > 0 && priced.margin_pct < 1, "margin % in (0,1)");

console.log("\n" + (fail === 0 ? "ALL MASTER BID GOLDEN ASSERTIONS PASSED" : fail + " FAILED"));
process.exit(fail ? 1 : 0);
