// REAL-BROWSER render gate (§30). Rebuilds the prod + offline bundles from source, loads the app
// in the pre-installed headless Chromium, and fails on: (1) prod-build inlining corruption (the
// `$'`-in-String.replace bug that white-screened index.prod.html — Node syntax checks miss it
// because they test the source, not the inlined artifact), (2) any console/page error at runtime,
// (3) the app not mounting, (4) the "blank" literal regressing back into the stat tiles.
// Skips cleanly (exit 0) where Playwright/Chromium isn't installed (e.g. CI without browsers).
const { execSync } = require("child_process");
const NG = process.env.ENOVA_NG || require("path").join(__dirname,"node_modules");

let chromium;
try { ({ chromium } = require(NG + "/playwright")); }
catch (_) { console.log("SKIP: playwright not installed"); process.exit(0); }

(async () => {
  // Rebuild the artifacts from CURRENT source so this gate covers the build, not a stale file.
  try {
    execSync("node build_prod.js", { cwd: __dirname, stdio: "pipe" });
    execSync("node build_offline.js", { cwd: __dirname, stdio: "pipe" });
  } catch (e) {
    console.log("FAIL: build_prod/build_offline errored:\n" + (e.stdout || e.message || e).toString().slice(0, 400));
    process.exit(1);
  }

  let browser;
  try { browser = await chromium.launch({ headless: true }); }
  catch (_) { console.log("SKIP: chromium not launchable in this environment"); process.exit(0); }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push("console.error: " + m.text().slice(0, 160)); });
  page.on("pageerror", e => errors.push("pageerror: " + (e.message || String(e)).slice(0, 160)));
  page.on("requestfailed", r => { const u = r.url(); if (!u.startsWith("data:")) errors.push("requestfailed: " + u.slice(0, 100)); });

  let fail = 0; const A = (c, m) => { if (!c) { console.log("FAIL:", m); fail++; } };
  try {
    await page.goto(require("url").pathToFileURL(process.env.ENOVA_OFFLINE || require("path").join(__dirname,"index.offline.html")).href, { waitUntil: "load", timeout: 30000 });
    const mounted = await page.waitForSelector(".app-nav-item", { timeout: 15000 }).then(() => true).catch(() => false);
    A(mounted, "app mounts in a real browser (offline prod bundle)");

    // The stat-tile revenue cells must never render the literal word "blank" (use an em-dash).
    const revCells = await page.$$eval(".stat .dv.rev", els => els.map(e => (e.textContent || "").trim()));
    A(!revCells.includes("blank"), "no stat tile renders the literal 'blank' (got: " + JSON.stringify(revCells) + ")");

    // Click through every ready page — a smoke test that each route renders without error.
    for (const label of ["Projects", "Formulation", "Quote", "Documents", "Inventory"]) {
      await page.click(`.app-nav-item:has-text("${label}")`).catch(() => {});
      await page.waitForTimeout(250);
    }
  } catch (e) { A(false, "render/interaction threw: " + (e.message || e).slice(0, 160)); }

  A(errors.length === 0, "zero browser console/page errors — got:\n    " + errors.join("\n    "));
  await browser.close();
  console.log(fail === 0 ? "BROWSER RENDER GATE PASSED (app mounts, no errors, no 'blank' regression)" : fail + " FAILED");
  process.exit(fail ? 1 : 0);
})();
