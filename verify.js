const fs = require("fs");
const html = fs.readFileSync((process.env.ENOVA_SRC||require("path").join(__dirname,"Enova_Brain_Studio_2.html")), "utf8");
console.log("Total lines:", html.split("\n").length);

const re = /<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g;
let m, code = "", n = 0;
while ((m = re.exec(html))) { code += "\n" + m[1]; n++; }
console.log("babel blocks:", n, "| chars:", code.length);

const parser = require((process.env.ENOVA_NG||require("path").join(__dirname,"node_modules"))+"/@babel/parser");
try {
  parser.parse(code, { sourceType: "script", plugins: ["jsx"] });
  console.log("BABEL PARSE: OK");
} catch (e) {
  console.log("BABEL PARSE: FAIL");
  console.log(e.message);
  const ln = e.loc ? e.loc.line : 0;
  console.log("...context...\n" + code.split("\n").slice(Math.max(0, ln - 4), ln + 2).join("\n"));
  process.exit(1);
}

function balance(s) {
  const c = {};
  for (const ch of "{}[]()") c[ch] = 0;
  s = s.replace(/\/\*[\s\S]*?\*\//g, "")
       .replace(/\/\/[^\n]*/g, "")
       .replace(/`(?:\\.|[^`\\])*`/g, "``")
       .replace(/"(?:\\.|[^"\\])*"/g, '""')
       .replace(/'(?:\\.|[^'\\])*'/g, "''");
  for (const ch of s) { if (ch in c) c[ch]++; }
  return c;
}
const c = balance(code);
console.log("Braces {}:", c["{"], c["}"], c["{"] === c["}"] ? "BALANCED" : "UNBALANCED");
console.log("Brackets []:", c["["], c["]"], c["["] === c["]"] ? "BALANCED" : "UNBALANCED");
console.log("Parens ():", c["("], c[")"], c["("] === c[")"] ? "BALANCED" : "UNBALANCED");
console.log("FormulationPage defs:", (code.match(/function FormulationPage\(/g) || []).length);
console.log("FormulationEditor defs:", (code.match(/function FormulationEditor\(/g) || []).length);
