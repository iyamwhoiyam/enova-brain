#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Enova Brain Studio — one-command regression suite.
# Runs every verifier + unit/golden test against Enova_Brain_Studio_2.html and
# reports a single PASS/FAIL summary. Exit code 0 only if EVERYTHING passes.
# Run this before every deploy:  bash run_all_tests.sh
# ─────────────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")" || exit 2
pass=0; fail=0; failed_list=""

run () {   # run <label> <cmd...>  — a step passes if it exits 0 AND prints no "FAIL"
  local label="$1"; shift
  local out; out="$("$@" 2>&1)"; local code=$?
  if [ $code -eq 0 ] && ! printf '%s' "$out" | grep -qiE '(^|[^A-Z])FAIL'; then
    printf "  ✅ %-26s %s\n" "$label" "$(printf '%s' "$out" | grep -iE 'PASS|OK|render|labor' | tail -1)"
    pass=$((pass+1))
  else
    printf "  ❌ %-26s (exit %s)\n" "$label" "$code"
    printf '%s\n' "$out" | grep -iE 'FAIL|Error' | head -4 | sed 's/^/        /'
    fail=$((fail+1)); failed_list="$failed_list $label"
  fi
}

echo "── Enova Brain Studio · regression suite ──────────────────────────"

# 1) Structural: Babel parse must be clean (the brace/bracket "UNBALANCED" lines
#    are a known false positive of verify.js's crude stripper — a clean parse is
#    the real signal, so we gate on "BABEL PARSE: OK", not on the balance lines).
babel_out="$(node verify.js 2>&1)"
if printf '%s' "$babel_out" | grep -q 'BABEL PARSE: OK'; then
  printf "  ✅ %-26s %s\n" "babel parse" "$(printf '%s' "$babel_out" | grep -i 'Total lines')"
  pass=$((pass+1))
else
  printf "  ❌ %-26s\n" "babel parse"; printf '%s\n' "$babel_out" | tail -5 | sed 's/^/        /'
  fail=$((fail+1)); failed_list="$failed_list babel"
fi

# 2) Behavioral / SSR renders (all components mount, docs include the base)
run "ssr renders"        node ssr_test.js
# 3) Deterministic parsers & generators
run "extraction parser"  node test_extract.js
run "clean-name parser"  node test_cleanname.js
run "intake gummy form"  node test_intake_gummy.js
run "master formula import" node test_master_formula_import.js
run "formulator capsules" node test_formulator_capsules.js
run "formulator forms"    node test_formulator_forms.js
run "formulator ui wiring" node test_formulator_ui.js
run "stickpack + cost override" node test_stickpack.js
run "slice1 unmatched cost"  node test_slice1_unmatched_cost.js
run "slice1 pp-grid cell"    node test_slice1_ppgrid.js
run "project-number format" node test_pn.js
run "enova brain kernel"  node test_enova_brain.js
run "kernel cost core"    node test_kernel_cost.js
run "kernel base parity"  node test_kernel_base.js
run "kernel formulate"    node test_kernel_formulate.js
run "kernel label engine" node test_kernel_label.js
run "gummy base math"    node test_gummy.js
run "packaging generator" node test_packaging.js
run "misys import"       node test_misys.js
# 4) Cost engine + governance + editable-grid + UI
run "masterbid golden"   node test_masterbid_golden.js
run "bulk per-piece"     node test_bulk.js
run "document costs"     node test_doc_costs.js
run "mfso editable model" node test_mfso.js
run "ui dialogs"         node test_ui_dialogs.js
run "browser render gate" node test_render_browser.js
run "kernel cost pipeline" node test_kernel_cost_browser.js
run "readiness board"    node shoot_readiness.js
run "commitment gate"    node shoot_commit.js
run "moq + margin"       node shoot_moq_margin.js
run "fronts + scope"     node shoot_fronts.js
run "wip manager matrix"  node shoot_wipmatrix.js
run "integrity gate"     node test_integrity.js
run "gated pages render"  node test_gated_pages.js
run "golden-thread gate"  node test_golden_thread.js
run "sales intake"        node test_intake.js
run "password mgmt"       node test_password.js
run "exec dashboard"      node test_dashboard.js
run "formula library"     node test_library.js
run "comms + qc"          node test_comms_qc.js
run "stock control"       node test_stockcontrol.js
run "document vault"      node test_vault.js
run "audit & trace"       node test_audit.js
run "command center"      node test_cc.js
run "command palette"     node shoot_cmdk.js
run "role gating"        node test_roles.js
run "per-row overage"    node test_overage.js
run "editable preview"   node test_preview.js
run "overage col render" node test_render.js

echo "───────────────────────────────────────────────────────────────────"
total=$((pass+fail))
if [ $fail -eq 0 ]; then
  echo "  ALL $total CHECKS PASSED — safe to deploy."
  exit 0
else
  echo "  $fail/$total FAILED:$failed_list"
  exit 1
fi
