// Test-harness shim: re-exports the Enova Brain kernel as a CommonJS module.
//
// Several tests (test_bulk, test_doc_costs, test_formulator_ui, test_render) inject the kernel
// into their SSR sandbox as `window.EnovaBrain = require("./_kernel_for_tests")`. The kernel
// (`enova_brain.js`) is a UMD factory that already assigns `module.exports = api` when CommonJS
// is present, so this file is a one-line pass-through. It exists as its own module because the
// tests reference it by that name; the original lived only in the (reclaimed) cloud workspace
// and is reconstructed here so the suite runs from a clean checkout.
//
// Override the kernel location with ENOVA_KERNEL if it is not alongside this file.
const path = require("path");
module.exports = require(process.env.ENOVA_KERNEL || path.join(__dirname, "enova_brain.js"));
