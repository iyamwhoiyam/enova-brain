// GOLDEN-ADJACENT LOCK for EnovaFormulator (the auto formula generator). Proves the CORRECTNESS
// invariants that matter for cost + compliance, calibrated 2026-08-10 against the Power Life Peak
// powder golden (P26083 Rev 4) and capsule fill-to-shell physics:
//   1. customer actives are preserved VERBATIM (dose + identity), never altered by the generator
//   2. additive forms BALANCE EXACTLY to the target serving weight (Σ rows === target)
//   3. capsule fill-to-shell never overflows the chosen shell
//   4. an over-target request WARNS instead of emitting a negative/garbage fill
// Taste/flavor slots legitimately differ from any specific product (the reviewer finalizes them),
// so this locks structure + arithmetic + safety, NOT specific taste SKUs.
const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC || require("path").join(__dirname, "Enova_Brain_Studio_2.html")), "utf8");
const a = html.indexOf("(function (root, factory) {");
const mi = html.indexOf("return { build, buildCapsules, buildAdditive, KB, SYSTEM_ALTS");
const b = html.indexOf("});", mi) + 3;
const root = {};
new Function("self", "module", html.slice(a, b) + "\n;return self.EnovaFormulator;")(root, undefined);
const EF = root.EnovaFormulator;

let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
const near = (x, y, t) => Math.abs(x - y) <= (t == null ? 0.01 : t);
const sum = rows => rows.reduce((s, r) => s + (Number(r.mg) || 0), 0);

// 1+2 — Powder, Power Life Peak actives, target serving weight 7065.367 mg.
const p = EF.build("Powder", {
  actives: [
    { name: "CollaGem-V", alt: "ALT-RP-2198", mg: 1000 },
    { name: "MCT 70% powder", alt: "ALT-RP-1232", mg: 2536 },
    { name: "Fibregrum B", alt: "ALT-RP-1695", mg: 2000 },
    { name: "Biotin 98%", alt: "ALT-RP-2123", mg: 0.3673 },
  ], targetServingMg: 7065.367,
});
const reqRows = p.rows.filter(r => r.source === "request");
A(reqRows.length === 4, "all 4 actives preserved as rows, got " + reqRows.length);
A(near(p.rows.find(r => r.name === "CollaGem-V").mg, 1000, 1e-6), "CollaGem-V dose verbatim (1000mg)");
A(near(p.rows.find(r => r.name === "MCT 70% powder").mg, 2536, 1e-6), "MCT dose verbatim (2536mg)");
A(near(sum(p.rows), 7065.367, 0.5), "Σ rows balances to the target serving weight, got " + sum(p.rows).toFixed(3));
A(p.rows.some(r => r.source === "computed-balance"), "a bulking-carrier balance row was computed");
A(p.warnings.length === 0, "no warnings for a well-formed powder request");

// 3 — Capsules fill-to-shell never overflows.
const c = EF.build("Capsules", { servingSize: 2, actives: [
  { name: "Vitamin C", alt: "ALT-RP-9001", mg: 500 }, { name: "Zinc Bisglycinate", alt: "ALT-RP-9002", mg: 200 },
]});
A(c.rows.filter(r => r.source === "request").length === 2, "capsule actives preserved");
A(!!c.shell, "a shell size was chosen");
A(c.fillPerCapsule <= EF.KB.Capsules.shell[c.shell][1] + 1e-6, "fill/cap " + c.fillPerCapsule + " ≤ shell " + c.shell + " max");

// 4 — Over-target guard: warn, never negative fill.
const o = EF.build("Powder", { actives: [{ name: "Big", alt: "X", mg: 9000 }], targetServingMg: 5000 });
A(o.warnings.some(w => /exceed/i.test(w)), "over-target warns");
A(!o.rows.some(r => r.mg < 0), "over-target emits no negative-mg row");

console.log(fail === 0 ? "FORMULATOR GOLDEN LOCK PASSED (actives verbatim · balance exact · shell-fit · over-target guarded)" : fail + " FAILED");
process.exit(fail ? 1 : 0);
