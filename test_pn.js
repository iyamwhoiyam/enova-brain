// §39 — project-number integrity. The canonical format is P{YY}{NNN} (P + 2-digit year + 3-digit
// sequence, e.g. P26205). Malformed numbers like P262112 must be REJECTED, never auto-created, and
// never inflate the next sequence. Numbers can only be assigned if free (not already used).
const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
function sliceFn(name){ const s=html.indexOf("function "+name+"("); let i=html.indexOf("{",s),d=0,e=-1;
  for(;i<html.length;i++){ if(html[i]==="{")d++; else if(html[i]==="}"){d--; if(d===0){e=i+1;break;}} } return html.slice(s,e); }
const body = [ sliceFn("isValidPN"), sliceFn("pnParts"), sliceFn("pnYear"), sliceFn("bumpPN"),
  sliceFn("nextPN"), sliceFn("uniquePN"),
  "return { isValidPN, pnParts, pnYear, bumpPN, nextPN, uniquePN };" ].join("\n");
const M = new Function("PN_RE", body)(/^P(\d{2})(\d{3})$/);
const yy = String(M.pnYear()).padStart(2,"0");

// ── format validation ──
A(M.isValidPN("P26205") === true, "P26205 is valid (P + YY + 3 digits)");
A(M.isValidPN("P25001") === true, "P25001 is valid (prior year)");
A(M.isValidPN("P262112") === false, "P262112 is INVALID (6 trailing digits) — the exact bug");
A(M.isValidPN("P252632") === false, "P252632 is INVALID (extra digit)");
A(M.isValidPN("P2620") === false, "P2620 is INVALID (only 2 sequence digits)");
A(M.isValidPN("P2620555") === false, "P2620555 is INVALID (too long)");
A(M.isValidPN("26205") === false, "26205 is INVALID (no P)");
A(M.isValidPN("P26205X") === false, "P26205X is INVALID (trailing letter)");
A(M.isValidPN("p26205") === true, "lowercase p26205 normalizes to valid");
A(M.isValidPN("") === false && M.isValidPN(null) === false, "empty / null are invalid");
A(JSON.stringify(M.pnParts("P26204")) === JSON.stringify({yr:26,seq:204}), "pnParts splits P26204 → yr 26 seq 204");
A(M.pnParts("P262112") === null, "pnParts rejects malformed P262112");

// ── next number: current year, +1, ignores malformed, guaranteed free ──
const projs = [ {pn:"P26122"}, {pn:"P26200"}, {pn:"P26204"}, {pn:"P25999"}, {pn:"P262112"}, {pn:"P252632"} ];
const nx = M.nextPN(projs);
A(M.isValidPN(nx), "nextPN returns a well-formed number: "+nx);
A(nx === "P"+yy+"205", "nextPN = P"+yy+"205 (max valid current-year seq 204 + 1; malformed P262112 ignored), got "+nx);
A(!projs.some(p=>p.pn===nx), "nextPN never collides with an existing number");
// first project of the year
A(M.nextPN([{pn:"P25500"}]) === "P"+yy+"001", "first current-year project → P"+yy+"001 (prior-year numbers don't carry over)");
// skips a taken number
A(M.nextPN([{pn:"P"+yy+"001"},{pn:"P"+yy+"002"}]) === "P"+yy+"003", "nextPN advances past taken current-year numbers");

// ── uniquePN: honor a valid+free desired; else next free ──
A(M.uniquePN(projs, "P26210") === "P26210", "a valid + FREE desired number is honored");
A(M.uniquePN(projs, "P26204") === nx, "a TAKEN desired number → next free (can't reuse an assigned number)");
A(M.uniquePN(projs, "P262112") === nx, "a MALFORMED desired number → next free (never creates a malformed pn)");
A(M.uniquePN(projs, "garbage") === nx, "garbage → next free");
A(M.isValidPN(M.uniquePN(projs, "P262112")), "uniquePN output is always well-formed");

// ── bumpPN keeps the strict format ──
A(M.bumpPN("P26204") === "P26205", "bumpPN P26204 → P26205");
A(M.bumpPN("P26009") === "P26010", "bumpPN pads the sequence: P26009 → P26010");
A(M.bumpPN("garbage") === "garbage", "bumpPN leaves a non-PN untouched");

console.log(fail === 0 ? "PROJECT-NUMBER INTEGRITY CHECKS PASSED" : fail + " FAILED");
process.exit(fail ? 1 : 0);
