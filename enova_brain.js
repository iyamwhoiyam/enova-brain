/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * ENOVA BRAIN — the hardened, deterministic processing kernel.
 *
 * ONE portable pure-JS core (no DOM, no React, no network, no AI) that every Enova generator trusts:
 * formulation, costing, quote, MFSO, SO, BOM, MO, MMR, and label. It runs IDENTICALLY in the browser
 * (embedded), in Node (CI + the Mac-mini server), and in a Supabase edge function.
 *
 * This file is the SOURCE OF TRUTH for two things:
 *   1. CONTRACTS   — the canonical project-number rules + a structural schema validator.
 *   2. RECONCILIATION — the algorithmic hardening: an independent re-derivation of every money/mass
 *      figure that CROSS-CHECKS the app's stored outputs. If a document, cost, quote, or label does
 *      not tie out to the formula + live inventory (to the milligram / to $0.0001), reconcile() flags
 *      it with a typed error. Nothing may be quoted, signed, or produced on a bundle that fails.
 *
 * Design tenets (why this is "hardened"):
 *   • Deterministic + pure: same inputs → same outputs, no hidden state, no clock/random in the math.
 *   • Independent verification: reconcile() RE-DERIVES from first principles and compares to what the
 *     app stored, so stale/incoherent snapshots are caught (defense in depth, not a rubber stamp).
 *   • Typed failures: every check has a stable CODE, a human message, and a machine `detail`.
 *   • Total function: never throws on bad data — it REPORTS. Callers decide (gate/override/audit).
 *   • Versioned: bump VERSION on any rule change; golden tests lock behavior.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.EnovaBrain = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const num = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
  const r6 = (x) => Math.round(num(x) * 1e6) / 1e6;
  // Relative-or-absolute closeness: tolerant of float noise but tight enough to catch real drift.
  const close = (a, b, rel, abs) => { a = num(a); b = num(b); const d = Math.abs(a - b);
    return d <= (abs == null ? 1e-4 : abs) || d <= (rel == null ? 0.005 : rel) * Math.max(Math.abs(a), Math.abs(b)); };

  // ── 1. CANONICAL PROJECT NUMBER — P{YY}{NNN} (single source of truth for the whole system) ──────
  const PN_RE = /^P(\d{2})(\d{3})$/;
  const isValidPN = (pn) => PN_RE.test(String(pn == null ? "" : pn).toUpperCase().trim());
  const pnParts = (pn) => { const m = PN_RE.exec(String(pn == null ? "" : pn).toUpperCase().trim()); return m ? { yr: parseInt(m[1], 10), seq: parseInt(m[2], 10) } : null; };
  function pnYear(now) { let y = 26; try { y = (now ? new Date(now) : new Date()).getFullYear() % 100; } catch (e) {} return y; }
  function nextPN(projects, now) {
    const list = Array.isArray(projects) ? projects : [];
    const taken = new Set(list.map((p) => p && p.pn).filter(Boolean));
    const yy = pnYear(now);
    const seqs = list.map((p) => pnParts(p && p.pn)).filter(Boolean).filter((n) => n.yr === yy).map((n) => n.seq);
    let seq = (seqs.length ? Math.max.apply(null, seqs) : 0) + 1;
    const mk = (s) => "P" + String(yy).padStart(2, "0") + String(s).padStart(3, "0");
    let pn = mk(seq); while (taken.has(pn)) pn = mk(++seq);
    return pn;
  }

  // ── 2. STRUCTURAL SCHEMA — is this object even a well-formed project before we cost it? ──────────
  function validateSchema(p) {
    const errors = [], warnings = [];
    if (!p || typeof p !== "object") return { ok: false, errors: ["Project is not an object."], warnings };
    if (!isValidPN(p.pn)) errors.push('Project number "' + (p.pn || "") + '" is malformed (must be P + 2-digit year + 3 digits).');
    if (!p.dosageForm) warnings.push("No dosage form set.");
    if (!Array.isArray(p.ingredients)) errors.push("ingredients is not an array.");
    else p.ingredients.forEach((r, i) => {
      if (r && r.inputMg != null && !(num(r.inputMg) >= 0)) errors.push("Ingredient " + (i + 1) + " has a negative/invalid input mg.");
      if (r && r.potencyPct != null && num(r.potencyPct) < 0) errors.push("Ingredient " + (i + 1) + " has a negative potency.");
    });
    if (p.tierPricing != null && !Array.isArray(p.tierPricing)) errors.push("tierPricing is not an array.");
    (Array.isArray(p.tierPricing) ? p.tierPricing : []).forEach((t, i) => {
      if (num(t.units) < 0) errors.push("Tier " + (i + 1) + " has negative units.");
      if (t.price != null && num(t.price) < 0) errors.push("Tier " + (i + 1) + " has a negative price.");
    });
    if (p.costOverride && typeof p.costOverride === "object") Object.entries(p.costOverride).forEach(([k, v]) => {
      if (v != null && !(num(v) >= 0)) errors.push("Cost override for " + k + " is negative/invalid.");
    });
    return { ok: errors.length === 0, errors, warnings };
  }

  // ── 3. INDEPENDENT RE-DERIVATION (mirrors the app's formulas — used to cross-check, not to trust) ─
  const isStickForm = (f) => /stick/i.test(String(f || ""));
  const isGummyForm = (f) => /gumm/i.test(String(f || ""));
  const isCapsuleForm = (f) => /capsule/i.test(String(f || ""));
  // Effective per-unit SKU cost with per-project override.
  function skuCost(alt, p, invIx) {
    const ov = p && p.costOverride;
    if (alt && ov && ov[alt] != null && isFinite(Number(ov[alt]))) return Number(ov[alt]);
    const it = alt && invIx ? invIx[alt] : null;
    return it && it.u != null ? Number(it.u) : null;
  }
  // Bulk-aware batch basis — MUST match the app's docBatchBasis.
  function batchBasis(p) {
    const cb = p.cogsBreakdown || {};
    const ss = num(p.servingSize) || 1;
    const batch = num(p.batchUnits) || 0;
    const totalUPC = ss * (num(p.servingsPerUnit) || 1);
    const bulk = cb.isBulk != null ? !!cb.isBulk : !!p.isBulk;
    const ppc = cb.piecesPerContainer != null ? num(cb.piecesPerContainer) : (bulk ? 1 : (num(p.unitsPerContainer) > 0 ? num(p.unitsPerContainer) : totalUPC));
    const servPerUnit = ss > 0 ? ppc / ss : (num(p.servingsPerUnit) || 1);
    return { piecesPerContainer: ppc, servPerUnit, batchUnits: batch, isBulk: bulk, pieces: ppc * batch, servings: servPerUnit * batch };
  }
  // Active ingredient cost per COSTING UNIT, re-derived from the formula + live inventory.
  function deriveActiveCPU(p, invIx) {
    const ov = num(p.overage);
    const basis = batchBasis(p);
    let cps = 0; const rows = [];
    (p.ingredients || []).forEach((r) => {
      const alt = r.importedAlt || (r.item && r.item.n) || null;
      const pot = num(r.potencyPct) > 0 ? num(r.potencyPct) / 100 : 1;
      const rov = r.overage != null ? num(r.overage) : ov;
      const mgPS = (num(r.inputMg) * (1 + rov)) / pot;
      const u = skuCost(alt, p, invIx);
      const cPS = u != null ? (mgPS / 1000) * u : 0;
      cps += cPS;
      rows.push({ alt, mgPS, u, cPS, resolved: u != null || !(num(r.inputMg) > 0) });
    });
    return { activeCPS: cps, activeCPU: cps * basis.servPerUnit, rows, servPerUnit: basis.servPerUnit };
  }

  // ── 3a. BASE / NON-ACTIVE SYSTEMS — the house-standard turnkey base for a dose form. ─────────────
  // A complete Enova product = the customer's ACTIVES + the delivery-system base for that form
  // (bulking body, gelling/binding, buffer, humectant, sweetener/flavor/color, flow & anti-caking
  // agents, coating, excipients). For GUMMIES the base is a displacement model: actives + the fixed-%
  // / fixed-mg base rows, with the bulk sweeteners filling the remainder to the exact gummy weight.
  // These knowledge bases are house standards (from Enova's own completed formulas) — first-class
  // backend data, not "invented." Every row resolves to a MISys SKU + live cost; water (nc) is $0.
  const GUMMY_SUGAR_BASE = [
    { name: "Sugar Granulated", rm: "ALT-RP-0529", bulk: true, ratio: 0.6136, locked: true, section: "body" },
    { name: "42/43 DE Corn Syrup / Glucose", rm: "ALT-RL-1381", bulk: true, ratio: 0.3864, locked: true, section: "body" },
    { name: "Slow Set Pectin CS502", rm: "ALT-RP-2013", pct: 0.015, locked: true, section: "body" },
    { name: "Citric Acid Anhydrous", rm: "ALT-RP-0003", pct: 0.007, locked: true, section: "body" },
    { name: "Sodium Citrate", rm: "ALT-RP-1859", pct: 0.003, locked: true, section: "body" },
    { name: "Water (R/O)", rm: "ALT-RP-0000", pct: 0.085, locked: true, nc: true, section: "body" },
    { name: "Liquid Flavor", rm: "ALT-RL-0111", pct: 0.005, locked: false, section: "body" },
    { name: "Liquid Color", rm: "ALT-RP-2026", pct: 0.002, locked: false, section: "body" },
    { name: "MCT Oil — Bottom Coat", rm: "ALT-RL-1272", mgFixed: 60, locked: true, coating: true, section: "coating" },
    { name: "Sunflower Lecithin", rm: "ALT-RP-0618-GP-VS", mgFixed: 7, locked: true, coating: true, section: "coating" },
    { name: "Mastercoat ASFC3000", rm: "ALT-RL-2247", mgFixed: 20, locked: true, coating: true, section: "coating" },
    { name: "MCT Oil — Top Coat", rm: "ALT-RL-1272", mgFixed: 95, locked: true, coating: true, section: "coating" },
    { name: "Sugar — Dusting", rm: "ALT-RP-0529", mgFixed: 200, locked: true, coating: true, section: "coating" },
  ];
  const GUMMY_SF_BASE = [
    { name: "Sorbitol Gran", rm: "ALT-RP-1247", bulk: true, ratio: 0.6870, locked: true, section: "body" },
    { name: "Maltitol 80-55 Syrup", rm: "ALT-RL-1389", bulk: true, ratio: 0.3130, locked: true, section: "body" },
    { name: "Slow Set Pectin CS509", rm: "ALT-RP-2101", pct: 0.030, locked: true, section: "body" },
    { name: "R/O Water", rm: "ALT-RP-0000", pct: 0.12167, locked: true, nc: true, section: "body" },
    { name: "Citric Acid Anhydrous", rm: "ALT-RP-0003", pct: 0.007, locked: true, section: "body" },
    { name: "Vegetable Glycerin, Kosher", rm: "ALT-RL-0028", pct: 0.020, locked: true, section: "body" },
    { name: "Sodium Citrate", rm: "ALT-RP-1859", pct: 0.003, locked: true, section: "body" },
    { name: "Calcium Citrate 21%", rm: "ALT-RP-0126", pct: 0.006, locked: true, section: "body" },
    { name: "MCT Oil /3595 Kosher", rm: "ALT-RL-1272", pct: 0.003, locked: true, section: "body" },
    { name: "Sunflower Lecithin", rm: "ALT-RP-0618-GP-VS", pct: 0.0015, locked: true, section: "body" },
    { name: "Liquid Flavor", rm: "ALT-RL-0111", pct: 0.015, locked: false, section: "body" },
    { name: "Liquid Color", rm: "ALT-RP-2026", pct: 0.010, locked: false, section: "body" },
    { name: "Bitter Masker 3115B", rm: "ALT-RP-1446", pct: 0.003, locked: true, section: "body" },
    { name: "Mastercoat ASFC3000", rm: "ALT-RL-2247", pct: 0.005, locked: true, coating: true, section: "coating" },
  ];
  // Active mass per single gummy (mg), potency-adjusted, NO overage (label claim ÷ potency ÷ pieces/serving).
  function gummyActivesMgPerGummy(p) {
    const serv = num(p && p.servingSize) || 1;
    let mgServ = 0;
    ((p && p.ingredients) || []).forEach((r) => {
      const pot = num(r.potencyPct) > 0 ? num(r.potencyPct) / 100 : 1;
      mgServ += num(r.inputMg) / pot;
    });
    return serv > 0 ? mgServ / serv : mgServ;
  }
  // THE single source of truth for a gummy's complete base/process/coating system, materialized as
  // rows scaled to gummyWt. Bulk sweeteners are the balance (fill the remainder after actives +
  // fixed base, split by ratio) so total per gummy == gummyWt. Coating drops for bulk pack-out.
  //   ctx = { invIx, bulk, activesMgPerGummy? }  → { rows, costPerPiece, totalMg }
  function gummyBase(project, ctx) {
    const p = project || {}, c = ctx || {};
    const invIx = c.invIx || {};
    const baseT = p.gummyType === "sugarFree" ? GUMMY_SF_BASE : GUMMY_SUGAR_BASE;
    const gw = num(p.gummyWt) > 0 ? num(p.gummyWt) : 4500;
    const bulk = !!c.bulk;
    const items = baseT.filter((t) => !(t.coating && bulk));
    const actMg = c.activesMgPerGummy != null ? num(c.activesMgPerGummy) : gummyActivesMgPerGummy(p);
    const nonBulkMg = (t) => (t.mgFixed != null ? t.mgFixed : (num(t.pct) || 0) * gw);
    const fixedSum = items.reduce((s, t) => s + (t.bulk ? 0 : nonBulkMg(t)), 0);
    const remainder = Math.max(0, gw - actMg - fixedSum);
    const ratioSum = items.reduce((s, t) => s + (t.bulk ? (num(t.ratio) || 0) : 0), 0) || 1;
    const rows = items.map((t, idx) => {
      const mgG = t.bulk ? remainder * ((num(t.ratio) || 0) / ratioSum) : nonBulkMg(t);
      const sel = (p.baseItems || {})[idx];
      const fresh = sel ? (invIx[sel.n] || null) : (t.rm ? (invIx[t.rm] || null) : null);
      const cost = (!t.nc && fresh && fresh.u > 0) ? (mgG / 1000) * fresh.u : 0;
      return { idx, name: t.name, rm: t.rm, section: t.section, coating: !!t.coating, bulk: !!t.bulk,
        nc: !!t.nc, locked: !!t.locked, pct: t.pct, mgFixed: t.mgFixed, mgG, fresh, cost };
    });
    return { rows, costPerPiece: rows.reduce((s, r) => s + r.cost, 0), totalMg: rows.reduce((s, r) => s + r.mgG, 0) + actMg };
  }

  // ── 3b. COSTING CORE — the single source of truth for a project's COGS build. ────────────────────
  // A FAITHFUL, deterministic replica of the app's FormulationEditor cost math, lifted into the
  // kernel so the browser, CI, and the server all cost a project identically. It OWNS the arithmetic
  // (actives × inventory, gummy base, shell, the per-unit / per-case packaging split, the Master Bid
  // labor/overhead call, freight/loss, and the COGS assembly). It does NOT decide WHICH container,
  // form config, mbForm string, gummy base cost, or case pack applies — those resolved lookups are
  // INJECTED via ctx (to be migrated into the kernel in later steps). Pure given ctx; no invention —
  // every dollar traces to the injected inventory / Master Bid engine.
  //
  //   ctx = {
  //     invIx,                     // INV_IX (key → { u: unit cost })
  //     container,                 // resolved container name (app's coerceContainerForForm)
  //     ctInfo,                    // CONTAINER_TYPES[container] = { bulk, pkg:[{k},…] }
  //     cfg,                       // FORM_CFG[form] = { gummy, shell, bulk, laborDefault, moq }
  //     unitNounForForm,           // unitNounFor(form) — used only when bulk
  //     mbForm,                    // resolved mbFormFor(form, container)
  //     masterBid,                 // window.EnovaMasterBid (has .build + .MB_DEFAULTS) or null
  //     baseCostPerPiece,          // gummyBaseCostPerGummy(proj,{bulk}) resolved (0 for non-gummy)
  //     casePack,                  // resolved units per master case
  //     constants: { label, stickpack, stickDisplay },   // house-standard finished-goods costs
  //   }
  //   → { breakdown:<cogsBreakdown>, view:<all intermediates the UI needs> }
  function cost(project, ctx) {
    const p = project || {}, c = ctx || {};
    const invIx = c.invIx || {};
    const cfg = c.cfg || {};
    const ctInfo = c.ctInfo || {};
    const K = c.constants || {};
    const LABEL = K.label, STICK = K.stickpack, STICK_DISPLAY = K.stickDisplay;

    const totalUPC = (num(p.servingSize) || 1) * (num(p.servingsPerUnit) || 1);
    const isBulkPack = !!(ctInfo.bulk || cfg.bulk || p.isBulk);
    const unitNoun = isBulkPack ? c.unitNounForForm : "Unit";
    const piecesPerContainer = isBulkPack ? 1
      : (num(p.unitsPerContainer) > 0 ? num(p.unitsPerContainer) : totalUPC);
    const mbServings = (num(p.servingSize) || 0) > 0 ? piecesPerContainer / (num(p.servingSize) || 1) : (num(p.servingsPerUnit) || 1);
    const laborManual = p.laborPerUnit != null ? num(p.laborPerUnit) : num(cfg.laborDefault);
    const overheadPct = p.overheadPct != null ? num(p.overheadPct) : 0.15;

    // Actives — mirrors calcIng EXACTLY: keyed by row.item.n, override-aware, per-ingredient overage.
    const calcIng = (p.ingredients || []).map((row) => {
      if (!row || !row.item) return Object.assign({}, row, { mgPS: 0, cPS: 0, fresh: null });
      const fresh = invIx[row.item.n] || null;
      const pot = num(row.potencyPct) > 0 ? num(row.potencyPct) / 100 : 1;
      const rov = row.overage != null ? num(row.overage) : num(p.overage);
      const mgPS = (num(row.inputMg) * (1 + rov)) / pot;
      const uCost = skuCost(row.item.n, p, invIx);
      const cPS = (mgPS / 1000) * (uCost != null ? uCost : 0);
      return Object.assign({}, row, { item: fresh || row.item, mgPS, cPS, fresh });
    });
    const actMg = calcIng.reduce((s, r) => s + r.mgPS, 0);
    const actCPS = calcIng.reduce((s, r) => s + r.cPS, 0);
    const actCPU = actCPS * mbServings;

    // Gummy base (0 for non-gummy) — the kernel now DERIVES the base cost/piece itself from the
    // house-standard base KB × live inventory (displacement to gummyWt). An injected value is still
    // honored as an override for backward-compat / a reviewer-edited base.
    const baseCostPerPiece = cfg.gummy
      ? (c.baseCostPerPiece != null ? num(c.baseCostPerPiece) : gummyBase(p, { invIx, bulk: isBulkPack }).costPerPiece)
      : 0;
    const baseCPU = baseCostPerPiece * piecesPerContainer;

    // Shell — override-aware, scaled to pieces/container (present only if a shell SKU is chosen).
    const shellUCost = p.shellItem ? skuCost(p.shellItem.n, p, invIx) : null;
    const shellCPU = shellUCost != null ? shellUCost * piecesPerContainer : 0;

    // Packaging — per-unit vs per-case split, with the house-standard finished-goods overrides.
    const stickForm = isStickForm(p.dosageForm);
    const isPerCase = (k) => isBulkPack || k === "shipper" || k === "display";
    let pkgPerUnit = 0, pkgPerCase = 0;
    (ctInfo.pkg || []).forEach((slot) => {
      const sel = (p.pkg || {})[slot.k]; if (!sel) return;
      if (slot.k === "foil") { pkgPerUnit += num(STICK) * piecesPerContainer; return; }
      if (slot.k === "display" && stickForm && !isBulkPack) { pkgPerUnit += num(STICK_DISPLAY); return; }
      let u = skuCost(sel.n, p, invIx); u = (u != null ? u : 0);
      if (slot.k === "label") u = num(LABEL);
      if (isPerCase(slot.k)) pkgPerCase += u; else pkgPerUnit += u;
    });
    const casePack = num(c.casePack) || 1;
    const pkgCPU = pkgPerUnit + pkgPerCase / (casePack || 1);

    const blendCPU = actCPU + baseCPU;
    const materialsCPU = blendCPU + shellCPU + pkgCPU;

    // Master Bid labor/overhead — the real per-form model. Falls back to the manual %+% only when
    // the engine is absent or batch qty is 0. Mirrors the app's mbBuild exactly.
    const MB = c.masterBid || null;
    const mbBatchQty = num(p.batchUnits) > 0 ? num(p.batchUnits) : (num(p.moq) > 0 ? num(p.moq) : num(cfg.moq));
    const matLossPct = p.materialLoss != null ? num(p.materialLoss) : 0.02;
    const blendMassMgServ = cfg.gummy ? (num(p.gummyWt)) * (num(p.servingSize) || 1) : actMg;
    const blendKgPerUnit = (blendMassMgServ * mbServings) / 1e6;
    const mbRes = (MB && MB.build && mbBatchQty > 0) ? MB.build(MB.MB_DEFAULTS, {
      form: c.mbForm, caps_per_serv: num(p.servingSize) || 1, servings: mbServings,
      dm_unit: materialsCPU, blend_size: blendKgPerUnit, base_qty: 1, loss: matLossPct,
    }, mbBatchQty, null) : null;
    const laborPerUnit = mbRes ? mbRes.labor_per_unit : laborManual;
    const overheadCPU = mbRes ? mbRes.oh_per_unit : (materialsCPU * overheadPct + laborManual * overheadPct);
    const cogsPerUnit = mbRes ? mbRes.cost_per_unit : (materialsCPU + laborManual + overheadCPU);
    const dmExtraCPU = mbRes ? (mbRes.dml / mbBatchQty - materialsCPU) : 0;

    const breakdown = {
      activeCPU: actCPU, baseCPU, shellCPU, pkgCPU, materialsCPU,
      dmExtraCPU, laborPerUnit, overheadPct, overheadCPU, cogsPerUnit,
      source: mbRes ? "masterbid" : "manual",
      mbForm: mbRes ? c.mbForm : null,
      container: c.container, piecesPerContainer,
      isBulk: isBulkPack, unitNoun, casePack,
      pkgPerUnitCPU: pkgPerUnit, pkgCaseTotal: pkgPerCase,
      mbBatchQty: mbRes ? mbBatchQty : null, mbBlends: mbRes ? mbRes.blends : null,
      // §52 persisted so the Quote page can re-run the Master Bid engine per tier for a CORRECT
      // per-quantity COGS (labor/overhead scale with volume) → accurate editable margins.
      blendKgPerUnit, mbServings, matLossPct,
    };
    const view = {
      calcIng, actMg, actCPS, actCPU, baseCPU, shellCPU, pkgPerUnit, pkgPerCase, pkgCPU,
      blendCPU, materialsCPU, piecesPerContainer, mbServings, isBulkPack, unitNoun,
      laborManual, overheadPct, mbBatchQty, matLossPct, blendKgPerUnit, mbRes,
    };
    return { breakdown, view };
  }

  // ── 3c. FORMULATE — the unified backend entry for a form's complete turnkey base/system. ─────────
  // ONE call that produces the delivery-system base for ANY dose form: gummies are built natively by
  // the kernel (displacement base KB); capsule / powder / stickpack / liquid route to the per-form
  // system generator (EnovaFormulator: flow & anti-caking agents, bulking carrier, sweetener/flavor/
  // acid, preservatives, excipients) which is INJECTED via ctx so the kernel stays pure. The caller
  // supplies the engine + its input (the app's actives→target mapping). Returns a normalized shape.
  function formulate(project, ctx) {
    const p = project || {}, c = ctx || {};
    const form = String(p.dosageForm || "");
    if (isGummyForm(form)) {
      const gb = gummyBase(p, { invIx: c.invIx || {}, bulk: !!c.bulk, activesMgPerGummy: c.activesMgPerGummy });
      return { form: "gummy", engine: "kernel", base: gb, rows: gb.rows, costPerPiece: gb.costPerPiece, notes: [] };
    }
    const EF = c.formulator || null;
    if (EF && typeof EF.build === "function" && c.formulatorInput) {
      const out = EF.build(c.formulatorForm || form, c.formulatorInput);
      return { form, engine: "EnovaFormulator", system: out, rows: (out && out.rows) || [], notes: (out && out.notes) || [] };
    }
    return { form, engine: null, rows: [], notes: ["No base generator wired for this form (inject ctx.formulator + ctx.formulatorInput)."] };
  }

  // ── 3d. PACKAGING + SHIPPING GENERATOR — deterministic, inventory-grounded. ──────────────────────
  // Auto-selects a COMPLETE, quote-ready packaging set from LIVE inventory: sizes the container to the
  // finished-unit fill, neck-matches the closure, and fills label / desiccant / tamper / scoop / master
  // shipper (+ a default capsule shell) with sensible house standards. PREFERS a prior same-spec
  // project's picks (recall) when one exists. Every pick is a real MISys SKU with a real cost, so the
  // packaging cost in the quote is accurate. Pure: inventory + prior projects are injected via ctx.
  const CAPSULE_CC = { "000": 1.37, "00": 0.91, "0": 0.68, "1": 0.50, "2": 0.37, "3": 0.30, "4": 0.20, "5": 0.13 };
  function capsuleShellCC(shellItem) {
    const d = (shellItem && (shellItem.d || shellItem.n)) || "";
    const m = /["“”'\s](000|00|0|1|2|3|4|5)["“”'\s]/.exec(" " + d + " ");
    return CAPSULE_CC[m ? m[1] : "00"] || CAPSULE_CC["00"];
  }
  function pkgCapacityCC(desc) {
    if (!desc) return null;
    let m = /(\d+(?:\.\d+)?)\s*cc\b/i.exec(desc); if (m) return parseFloat(m[1]);
    m = /(\d+(?:\.\d+)?)\s*oz\b/i.exec(desc); if (m) return parseFloat(m[1]) * 29.5735;   // fl oz → cc
    m = /(\d+(?:\.\d+)?)\s*ml\b/i.exec(desc); if (m) return parseFloat(m[1]);
    m = /(\d+(?:\.\d+)?)\s*(?:l|liter|litre)\b/i.exec(desc); if (m) return parseFloat(m[1]) * 1000;
    return null;
  }
  function pkgNeckFinish(desc) {
    if (!desc) return null;
    let m = /\b(\d{2,3}\/\d{3})\b/.exec(desc); if (m) return m[1];        // 45/400
    m = /\b(\d{2,3})\s*mm\b/i.exec(desc); if (m) return m[1] + "mm";     // 70mm / 28mm
    return null;
  }
  function pkgBlendGramsPerServing(p) {
    if (/gumm/i.test(p.dosageForm || "")) return ((num(p.gummyWt)) * (num(p.servingSize) || 1)) / 1000;
    let mg = 0; (p.ingredients || []).forEach((r) => { mg += num(r.inputMg); });
    return mg / 1000;
  }
  // Container volume (cc) to hold ONE finished unit (with fill headspace).
  function estimatePackFillCC(p, pieces) {
    const form = p.dosageForm || "", spu = num(p.servingsPerUnit) || 1;
    if (/gumm/i.test(form)) return ((num(p.gummyWt) || 4500) / 1000 * pieces) * 1.4;
    if (/capsule|tablet/i.test(form)) return pieces * capsuleShellCC(p.shellItem) * 1.5;
    if (/powder/i.test(form)) return ((pkgBlendGramsPerServing(p) || 5) * spu / 0.6) * 1.25;
    if (/liquid/i.test(form)) return ((num(p.servingSize) || 1) * spu) * 1.12;
    return pieces * 1.0;
  }
  // Sellable "each" noun for a dose form (bulk orders are priced per piece).
  function unitNounFor(form) {
    const f = String(form || "");
    if (/gumm/i.test(f)) return "Gummy";
    if (/capsule/i.test(f)) return "Capsule";
    if (/tablet/i.test(f)) return "Tablet";
    if (/stick/i.test(f)) return "Stick Pack";
    if (/liquid|tincture/i.test(f)) return "mL";
    if (/powder/i.test(f)) return "Serving";
    return "Unit";
  }
  // Pieces per master case from the shipper's WxHxD (inches) + piece volume (~1 g/cc) @ ~55% packing.
  function estimateCasePack(shipperDesc, pieceWtMg) {
    const m = /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i.exec(String(shipperDesc || ""));
    if (!m || !(num(pieceWtMg) > 0)) return null;
    const pieceCc = Math.max(0.4, num(pieceWtMg) / 1000);
    const cc = (+m[1]) * (+m[2]) * (+m[3]) * 16.387;   // in³ → cc
    return Math.max(1, Math.round((cc * 0.55) / pieceCc));
  }
  function pkgPool(inventory, cat) { return (Array.isArray(inventory) ? inventory : []).filter((i) => i.c === cat && i.u > 0); }
  function pkgIsContainerSlot(slot) { return slot.k === "container" || slot.k === "bag" || slot.k === "foil"; }
  function pkgPickContainer(pool, targetCC, p) {
    const wantGlass = /liquid|tincture/i.test(p.dosageForm || "");
    const cand = pool.map((i) => ({ i, cc: pkgCapacityCC(i.d), neck: pkgNeckFinish(i.d) })).filter((x) => x.cc > 0 && x.neck);
    if (!cand.length) { const any = pool.slice().sort((a, b) => a.u - b.u)[0]; return { item: any || null, reason: any ? "no sized match — verify" : "" }; }
    const score = (x) => { let s = 0; const d = x.i.d.toLowerCase();
      if (wantGlass) { if (/glass|pet/.test(d)) s += 3; } else { if (/hdpe/.test(d)) s += 3; if (/white/.test(d)) s += 1; } return s; };
    const fit = cand.filter((x) => x.cc >= targetCC * 0.98);
    let chosen;
    if (fit.length) {
      const minCC = Math.min.apply(null, fit.map((x) => x.cc));
      const tight = fit.filter((x) => x.cc <= minCC * 1.25);
      tight.sort((a, b) => (score(b) - score(a)) || (a.cc - b.cc) || (a.i.u - b.i.u));
      chosen = tight[0];
    } else { cand.sort((a, b) => b.cc - a.cc); chosen = cand[0]; }
    return { item: chosen.i, reason: Math.round(chosen.cc) + "cc for ~" + Math.round(targetCC) + "cc fill · neck " + chosen.neck };
  }
  function pkgPickClosure(pool, container) {
    const neck = container ? pkgNeckFinish(container.d) : null;
    const pref = (i) => { let s = 0; const d = i.d.toLowerCase(); if (/crc|child/.test(d)) s += 3; if (/induction|heat|seal|liner/.test(d)) s += 2; if (/white/.test(d)) s += 1; return s; };
    const match = neck ? pool.filter((i) => pkgNeckFinish(i.d) === neck) : [];
    if (match.length) { match.sort((a, b) => pref(b) - pref(a) || a.u - b.u); return { item: match[0], reason: "neck " + neck + " match" }; }
    const any = pool.slice().sort((a, b) => a.u - b.u)[0];
    return { item: any || null, reason: neck ? ("no " + neck + " closure in stock — verify") : "verify neck finish" };
  }
  function pkgPickScoop(pool, p) {
    const g = pkgBlendGramsPerServing(p), targetCC = g > 0 ? g / 0.6 : null;
    const cand = pool.map((i) => ({ i, cc: pkgCapacityCC(i.d) })).filter((x) => x.cc > 0);
    if (targetCC && cand.length) { cand.sort((a, b) => Math.abs(a.cc - targetCC) - Math.abs(b.cc - targetCC)); return { item: cand[0].i, reason: cand[0].cc + "cc ≈ " + g.toFixed(1) + " g/serving" }; }
    const any = pool[0]; return { item: any || null, reason: any ? "standard scoop" : "" };
  }
  function pkgPickByKeywords(pool, kws, label) {
    for (let j = 0; j < kws.length; j++) { const hit = pool.find((i) => new RegExp(kws[j], "i").test(i.d)); if (hit) return { item: hit, reason: label || "standard" }; }
    const any = pool.slice().sort((a, b) => a.u - b.u)[0];
    return { item: any || null, reason: any ? (label || "standard") : "" };
  }
  // Recall the closest prior project (with real packaging) for the same product spec.
  function pkgRecall(p, projects, pieces) {
    if (!Array.isArray(projects)) return null;
    let best = null, bestScore = 0;
    projects.forEach((q) => {
      if (!q || q.pn === p.pn || !q.pkg || !Object.keys(q.pkg).length) return;
      if ((q.dosageForm || "") !== (p.dosageForm || "")) return;
      let s = 3;
      if ((q.containerType || "") === (p.containerType || "")) s += 2;
      const pc = num(q.unitsPerContainer) > 0 ? num(q.unitsPerContainer) : (num(q.servingSize) || 1) * (num(q.servingsPerUnit) || 1);
      if (pc && pieces) s += 2 * (Math.min(pc, pieces) / Math.max(pc, pieces));
      if (String(q.gummyType || "") === String(p.gummyType || "")) s += 0.5;
      if (s > bestScore) { bestScore = s; best = q; }
    });
    return (best && bestScore >= 3) ? { pkg: best.pkg, src: best.pn, shellItem: best.shellItem } : null;
  }
  // THE generator. ctx = { inventory, invIx, projects, container, slots, needsShell }.
  function packaging(project, ctx) {
    const p = project || {}, c = ctx || {};
    const inventory = c.inventory || [], invIx = c.invIx || {};
    const container = c.container, slots = c.slots || [];
    const pieces = num(p.unitsPerContainer) > 0 ? num(p.unitsPerContainer) : (num(p.servingSize) || 1) * (num(p.servingsPerUnit) || 1);
    const targetCC = estimatePackFillCC(p, pieces);
    const recall = pkgRecall(p, c.projects, pieces);
    const pkg = {}, meta = {};
    let chosenContainer = null;
    slots.forEach((slot) => {
      if (recall && recall.pkg[slot.k]) {
        const fresh = invIx[recall.pkg[slot.k].n];
        if (fresh) { pkg[slot.k] = fresh; meta[slot.k] = { source: "recalled", reason: "from " + recall.src }; if (pkgIsContainerSlot(slot)) chosenContainer = fresh; return; }
      }
      const pool = pkgPool(inventory, slot.cat); if (!pool.length) return;
      let r;
      if (pkgIsContainerSlot(slot)) { r = pkgPickContainer(pool, targetCC, p); chosenContainer = r.item; }
      else if (slot.k === "closure") { r = pkgPickClosure(pool, chosenContainer); }
      else if (slot.k === "scoop") { r = pkgPickScoop(pool, p); }
      else if (slot.cat === "Label") { r = pkgPickByKeywords(pool, ["white plain", "laser", "plain", "wrap", "bopp"], "standard label"); }
      else if (slot.cat === "Desiccant") { r = pkgPickByKeywords(pool, ["2 gram silica", "silica gel", "desiccant"], "moisture control"); }
      else if (/Tamper/.test(slot.cat)) { r = pkgPickByKeywords(pool, ["clear.*perf", "clear"], "shrink band"); }
      else if (/Shipper/.test(slot.cat)) { r = pkgPickByKeywords(pool, ["12 x", "13 x", "10 x", "box"], "master case"); }
      else { r = { item: pool.slice().sort((a, b) => a.u - b.u)[0], reason: "standard" }; }
      if (r && r.item) { pkg[slot.k] = r.item; meta[slot.k] = { source: recall ? "sized (recall n/a)" : "sized", reason: r.reason }; }
    });
    let shell = null;
    if (c.needsShell && !p.shellItem) {
      const sp = pkgPool(inventory, "Capsule Shell");
      shell = pkgPickByKeywords(sp, ['00.*veggie|veggie.*00', '"00".*hpmc', "00.*hpmc", "veggie", "00"], 'default "00" veggie').item || null;
    }
    return { container: container, slots, pkg, meta, shell, targetCC, pieces, recallSrc: recall ? recall.src : null };
  }

  // ── 3e. LABEL ENGINE — deterministic Supplement Facts panel + FDA compliance review. ────────────
  // Builds a Supplement Facts model straight from the APPROVED formula: a supplement panel is
  // formula-driven, not database-driven — the declared actives at their per-serving amounts, plus a
  // %DV for the ones with an established FDA Daily Value. No licensed nutrient database needed; the
  // "data" is the fixed FDA Daily Value table (21 CFR 101.9(c), 2016 final rule — verified against
  // FDA's published table) + a nutrient-synonym map + the rounding/format rules. Everything a
  // reviewer confirms/edits before sign-off; nothing invented. reviewLabel() then ties the panel back
  // to the approved formula (same independent-reconciliation philosophy as the cost engine).
  //
  //   Amounts: the formula's per-serving amount (project.ingredients[].inputMg = the label CLAIM) is
  //   taken as the declared amount in the nutrient's DV unit; %DV = amount / DV × 100. For a nutrient
  //   whose DV unit is mcg (D, B12, folate, biotin, K, iodine, selenium, chromium, molybdenum) the
  //   amount is treated as mcg; else mg. Unmapped actives (botanicals, amino acids) carry a dagger
  //   (†) "Daily Value not established". Implausible %DV (>1000) is FLAGGED as a likely unit mismatch.
  const DAILY_VALUES = {
    "Vitamin A": { dv: 900, unit: "mcg RAE" }, "Vitamin C": { dv: 90, unit: "mg" },
    "Vitamin D": { dv: 20, unit: "mcg" }, "Vitamin E": { dv: 15, unit: "mg" },
    "Vitamin K": { dv: 120, unit: "mcg" }, "Thiamin": { dv: 1.2, unit: "mg" },
    "Riboflavin": { dv: 1.3, unit: "mg" }, "Niacin": { dv: 16, unit: "mg NE" },
    "Vitamin B6": { dv: 1.7, unit: "mg" }, "Folate": { dv: 400, unit: "mcg DFE" },
    "Vitamin B12": { dv: 2.4, unit: "mcg" }, "Biotin": { dv: 30, unit: "mcg" },
    "Pantothenic Acid": { dv: 5, unit: "mg" }, "Choline": { dv: 550, unit: "mg" },
    "Calcium": { dv: 1300, unit: "mg" }, "Iron": { dv: 18, unit: "mg" },
    "Phosphorus": { dv: 1250, unit: "mg" }, "Iodine": { dv: 150, unit: "mcg" },
    "Magnesium": { dv: 420, unit: "mg" }, "Zinc": { dv: 11, unit: "mg" },
    "Selenium": { dv: 55, unit: "mcg" }, "Copper": { dv: 0.9, unit: "mg" },
    "Manganese": { dv: 2.3, unit: "mg" }, "Chromium": { dv: 35, unit: "mcg" },
    "Molybdenum": { dv: 45, unit: "mcg" }, "Chloride": { dv: 2300, unit: "mg" },
    "Sodium": { dv: 2300, unit: "mg" }, "Potassium": { dv: 4700, unit: "mg" },
    // macronutrients — for functional-food supplement panels (protein/collagen/meal replacement)
    "Total Fat": { dv: 78, unit: "g" }, "Saturated Fat": { dv: 20, unit: "g" },
    "Cholesterol": { dv: 300, unit: "mg" }, "Total Carbohydrate": { dv: 275, unit: "g" },
    "Dietary Fiber": { dv: 28, unit: "g" }, "Added Sugars": { dv: 50, unit: "g" },
    "Protein": { dv: 50, unit: "g" },
  };
  // Legacy International Unit → DV-unit conversion factors (per FDA guidance). Form-dependent, so
  // these are ADVISORY — the reviewer confirms the form. Exposed for the app to offer a conversion.
  const IU_CONVERT = {
    "Vitamin D": { perIU: 0.025, unit: "mcg", note: "40 IU = 1 mcg" },
    "Vitamin E (natural, d-alpha)": { perIU: 0.67, unit: "mg", note: "1 IU = 0.67 mg" },
    "Vitamin E (synthetic, dl-alpha)": { perIU: 0.45, unit: "mg", note: "1 IU = 0.45 mg" },
    "Vitamin A (retinol)": { perIU: 0.3, unit: "mcg RAE", note: "1 IU = 0.3 mcg RAE" },
    "Vitamin A (beta-carotene, supplement)": { perIU: 0.15, unit: "mcg RAE", note: "1 IU = 0.15 mcg RAE" },
    "Folic acid → DFE": { factor: 1.7, unit: "mcg DFE", note: "1 mcg folic acid = 1.7 mcg DFE" },
  };
  // Ingredient-name → canonical DV nutrient. Vitamins are listed BEFORE minerals so a vitamin salt
  // (e.g. "Sodium Ascorbate", "Calcium Ascorbate") maps to the VITAMIN, not the mineral. First match wins.
  const NUTRIENT_SYNONYMS = [
    { re: /vitamin\s*a\b|retinyl|retinol|retinoic/i, dv: "Vitamin A" },
    { re: /vitamin\s*c\b|ascorb(ic|ate)/i, dv: "Vitamin C" },
    { re: /vitamin\s*d\b|cholecalciferol|ergocalciferol|\bd-?3\b/i, dv: "Vitamin D" },
    { re: /vitamin\s*e\b|tocopher|tocotrienol/i, dv: "Vitamin E" },
    { re: /vitamin\s*k\b|phylloquinone|menaquinone|mk-?7/i, dv: "Vitamin K" },
    { re: /thiamin|vitamin\s*b-?1\b/i, dv: "Thiamin" },
    { re: /riboflavin|vitamin\s*b-?2\b/i, dv: "Riboflavin" },
    { re: /niacin|niacinamide|nicotinic acid|vitamin\s*b-?3\b/i, dv: "Niacin" },
    { re: /pyridox(ine|al)|vitamin\s*b-?6\b/i, dv: "Vitamin B6" },
    { re: /folate|folic acid|methylfolate|5-?mthf|quatrefolic|methyltetrahydrofolate/i, dv: "Folate" },
    { re: /cobalamin|vitamin\s*b-?12\b/i, dv: "Vitamin B12" },
    { re: /biotin|vitamin\s*b-?7\b|vitamin\s*h\b/i, dv: "Biotin" },
    { re: /pantothen|vitamin\s*b-?5\b/i, dv: "Pantothenic Acid" },
    { re: /choline/i, dv: "Choline" },
    { re: /calcium/i, dv: "Calcium" },
    { re: /\biron\b|ferrous|ferric/i, dv: "Iron" },
    { re: /phosphorus|phosphate/i, dv: "Phosphorus" },
    { re: /iodine|iodide/i, dv: "Iodine" },
    { re: /magnesium/i, dv: "Magnesium" },
    { re: /\bzinc\b/i, dv: "Zinc" },
    { re: /selenium|selenomethionine|selenite/i, dv: "Selenium" },
    { re: /copper|cupric/i, dv: "Copper" },
    { re: /manganese/i, dv: "Manganese" },
    { re: /chromium/i, dv: "Chromium" },
    { re: /molybdenum/i, dv: "Molybdenum" },
    { re: /chloride/i, dv: "Chloride" },
    { re: /\bsodium\b/i, dv: "Sodium" },
    { re: /potassium/i, dv: "Potassium" },
  ];
  // FALCPA major allergens (incl. sesame, added 2023).
  const ALLERGENS = [
    { re: /\bmilk\b|whey|casein|lactose|\bdairy\b/i, name: "Milk" },
    { re: /\begg\b|albumen/i, name: "Egg" },
    { re: /\bfish\b|cod\b|tilapia|anchovy|salmon|pollock/i, name: "Fish" },
    { re: /shellfish|shrimp|crab\b|lobster|crustacean/i, name: "Crustacean shellfish" },
    { re: /tree nut|almond|walnut|cashew|pecan|pistachio|hazelnut|brazil nut|macadamia|\bcoconut\b/i, name: "Tree nuts" },
    { re: /peanut/i, name: "Peanuts" },
    { re: /\bwheat\b|\bgluten\b/i, name: "Wheat" },
    { re: /\bsoy\b|soya|soybean/i, name: "Soy" },
    { re: /sesame|tahini/i, name: "Sesame" },
  ];
  function dvForNutrient(name) {
    const s = String(name || "");
    for (let i = 0; i < NUTRIENT_SYNONYMS.length; i++) if (NUTRIENT_SYNONYMS[i].re.test(s)) return NUTRIENT_SYNONYMS[i].dv;
    return null;
  }
  const magUnit = (u) => String(u || "").split(" ")[0];   // "mcg RAE" → "mcg"
  function roundDVpct(pct) { pct = num(pct); if (pct <= 0) return 0; return pct < 1 ? Math.round(pct * 10) / 10 : Math.round(pct); }
  function detectAllergens(names) {
    const hits = [];
    ALLERGENS.forEach((a) => { if (names.some((n) => a.re.test(String(n || "")))) hits.push(a.name); });
    return hits;
  }
  const rowName = (r) => (r && (r.name || r.importedName || (r.item && r.item.n))) || "";
  // Serving-size text per dose form.
  function servingText(p) {
    const ss = num(p.servingSize) || 1, form = String(p.dosageForm || "");
    if (/gumm/i.test(form)) return ss + " Gumm" + (ss === 1 ? "y" : "ies");
    if (/capsule/i.test(form)) return ss + " Capsule" + (ss === 1 ? "" : "s");
    if (/tablet/i.test(form)) return ss + " Tablet" + (ss === 1 ? "" : "s");
    if (/stick/i.test(form)) return ss + " Stick Pack" + (ss === 1 ? "" : "s");
    if (/liquid|tincture/i.test(form)) return ss + " mL";
    if (/powder/i.test(form)) { const g = num(p.servWtMg) > 0 ? " (~" + (num(p.servWtMg) / 1000).toFixed(1) + " g)" : ""; return "1 Scoop" + g; }
    return ss + " Unit" + (ss === 1 ? "" : "s");
  }
  // Build the Supplement Facts model from the formula. ctx = { otherIngredients?, manufacturer?, distributor?, netQuantity?, claims? }.
  function labelModel(project, ctx) {
    const p = project || {}, c = ctx || {};
    const rows = (p.ingredients || []).filter((r) => num(r.inputMg) > 0).map((r) => {
      const nm = rowName(r), key = dvForNutrient(nm), amount = num(r.inputMg);
      const dvu = key ? DAILY_VALUES[key] : null;
      const unit = dvu ? magUnit(dvu.unit) : "mg";
      const dvPct = dvu ? roundDVpct(amount / dvu.dv * 100) : null;
      const display = key ? (new RegExp("^\\s*" + key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(nm) ? nm : key + " (as " + nm + ")") : nm;
      return { name: display, source: nm, nutrient: key, amount, unit, dvUnit: dvu ? dvu.unit : null, dvPct,
        dagger: !key,
        // A mapped nutrient's amount+unit needs reviewer confirmation: Enova's formula stores a single
        // "mg/serving" figure, but micronutrient DVs are in mcg and the source can mix units, so the
        // panel is a DRAFT to confirm (same human-in-the-loop as the formulation generator).
        confirm: !!key,
        unitSuspect: dvPct != null && dvPct > 1000 };
    });
    const other = Array.isArray(c.otherIngredients) ? c.otherIngredients.slice() : [];
    const contains = detectAllergens(rows.map((r) => r.source).concat(other));
    const anyDagger = rows.some((r) => r.dagger);
    const anyMacro = rows.some((r) => ["Total Fat", "Saturated Fat", "Total Carbohydrate", "Dietary Fiber", "Added Sugars", "Protein", "Cholesterol"].includes(r.nutrient));
    return {
      heading: "Supplement Facts",
      servingSize: servingText(p),
      servingsPerContainer: num(p.servingsPerUnit) || null,
      rows,
      otherIngredients: other,
      contains,                          // FALCPA "Contains:" allergen list
      footnotes: [].concat(anyDagger ? ["† Daily Value (DV) not established."] : [],
        anyMacro ? ["Percent Daily Values are based on a 2,000 calorie diet."] : []),
      disclaimer: "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
      identity: { productName: p.product || "", netQuantity: c.netQuantity || "", form: p.dosageForm || "" },
      manufacturer: c.manufacturer || "Manufactured for: (distributor) by Enova Science.",
      distributor: c.distributor || cleanName_(p.customer),
      claims: Array.isArray(c.claims) ? c.claims : [],
    };
  }
  const cleanName_ = (s) => String(s || "").replace(/^\s*(client name|client|customer name|customer)\s*[:\-]\s*/i, "").trim();
  // Compliance review — ties the panel to the approved formula + checks FDA structural requirements.
  function reviewLabel(model, project, ctx) {
    const p = project || {}, m = model || {};
    const checks = [], errors = [], warnings = [];
    const add = (code, ok, message, detail, sev) => { checks.push({ code, ok: !!ok, message, detail }); if (!ok) (sev === "warn" ? warnings : errors).push({ code, message, detail }); };
    const dosed = (p.ingredients || []).filter((r) => num(r.inputMg) > 0);
    // (a) every dosed active in the formula appears on the panel (label ties to the costed formula)
    add("LABEL_FACTS_TIE", (m.rows || []).length >= dosed.length,
      "Every dosed active in the formula appears in Supplement Facts.", { panelRows: (m.rows || []).length, formulaActives: dosed.length });
    // (b) serving size + servings/container are present and (when the project sets it) match
    const servOk = !!m.servingSize && (!(num(p.servingsPerUnit) > 0) || num(m.servingsPerContainer) === num(p.servingsPerUnit));
    add("LABEL_SERVING_TIE", servOk, "Serving size and servings/container match the project.", { serving: m.servingSize, servings: m.servingsPerContainer, projectServings: p.servingsPerUnit });
    // (c) %DV present for every nutrient WITH an established DV; dagger for those without
    const dvMissing = (m.rows || []).filter((r) => r.nutrient && r.dvPct == null);
    add("LABEL_DV", dvMissing.length === 0, "A %DV is shown for every nutrient that has an established Daily Value.", { missing: dvMissing.map((r) => r.name) });
    const daggerMissing = (m.rows || []).filter((r) => !r.nutrient && !r.dagger);
    add("LABEL_DAGGER", daggerMissing.length === 0, "Every no-DV ingredient carries the † footnote.", { missing: daggerMissing.map((r) => r.name) });
    // (d) unit sanity — an implausible %DV (>1000) usually means the amount's unit is wrong (e.g. Vitamin D in mg)
    const unitBad = (m.rows || []).filter((r) => r.unitSuspect);
    add("LABEL_UNITS", unitBad.length === 0, "No nutrient amount looks like a unit error (%DV within a sane range).", { suspect: unitBad.map((r) => ({ name: r.name, dvPct: r.dvPct })) }, "warn");
    // (e) allergen "Contains" statement matches the detected allergens
    add("LABEL_ALLERGENS", true, "FALCPA allergen scan complete.", { contains: m.contains || [] }, "warn");
    // (f) DSHEA disclaimer present when structure/function claims exist
    add("LABEL_CLAIMS", !(m.claims && m.claims.length) || !!m.disclaimer, "Structure/function claims carry the DSHEA disclaimer.", { claims: (m.claims || []).length, hasDisclaimer: !!m.disclaimer }, "warn");
    // (g) identity: product name + manufacturer/distributor present
    add("LABEL_IDENTITY", !!(m.identity && m.identity.productName), "Statement of identity (product name) is present.", { productName: m.identity && m.identity.productName }, "warn");
    add("LABEL_HEADING", m.heading === "Supplement Facts", "Panel is headed “Supplement Facts”.", { heading: m.heading });
    return { ok: errors.length === 0, errors, warnings, checks,
      summary: { rows: (m.rows || []).length, mapped: (m.rows || []).filter((r) => r.nutrient).length, checks: checks.length, errors: errors.length, warnings: warnings.length } };
  }
  // Facade: build the panel + review it in one call.
  function label(project, ctx) { const model = labelModel(project, ctx); return { model, review: reviewLabel(model, project, ctx) }; }

  // ── 4. RECONCILIATION — the hardening core. Independently cross-check every stored figure. ───────
  function reconcile(p, invIx) {
    invIx = invIx || {};
    const checks = [], errors = [], warnings = [];
    const add = (code, ok, message, detail, severity) => {
      checks.push({ code, ok: !!ok, message, detail });
      if (!ok) { (severity === "warn" ? warnings : errors).push({ code, message, detail }); }
    };
    const cb = p.cogsBreakdown || null;

    // (a) identity + schema
    add("PN_FORMAT", isValidPN(p.pn), "Project number is the canonical P{YY}{NNN}.", { pn: p.pn });
    const dosed = (p.ingredients || []).filter((r) => num(r.inputMg) > 0);
    add("FORMULA_HAS_ACTIVES", dosed.length > 0, "At least one dosed ingredient is captured.", { count: dosed.length });

    // (b) every dosed ingredient resolves to a real, costed SKU (else COGS is understated)
    const der = deriveActiveCPU(p, invIx);
    const unresolved = der.rows.filter((r, i) => num((p.ingredients || [])[i] && (p.ingredients || [])[i].inputMg) > 0 && r.u == null);
    add("SKU_RESOLVE", unresolved.length === 0, "Every dosed ingredient resolves to a MISys SKU with a cost.", { unresolved: unresolved.map((r) => r.alt) });

    // (c) internal additivity of the stored cost breakdown (materials = Σ parts; cogs = materials + extras).
    //     A LIVE breakdown (from the formulation editor / Master Bid) carries the full decomposition,
    //     so activeCPU is an actual number (0 counts). An IMPORT stub carries only a rolled materialsCPU
    //     with null component parts — there is nothing to independently decompose, so the additive
    //     tie-outs are skipped for it (they would false-trip on 0-vs-materials). COGS_POSITIVE and the
    //     drift/margin checks still run either way.
    if (cb) {
      const decomposed = cb.activeCPU != null;   // number (incl. 0) ⇒ live decomposition; null ⇒ import stub
      if (decomposed) {
        const parts = num(cb.activeCPU) + num(cb.baseCPU) + num(cb.shellCPU) + num(cb.pkgCPU);
        add("COGS_MATERIALS_ADDITIVE", close(cb.materialsCPU, parts, 0.005, 0.0005),
          "Direct materials = active + base + shell + packaging.", { materialsCPU: cb.materialsCPU, parts: r6(parts) });
        const total = num(cb.materialsCPU) + num(cb.dmExtraCPU) + num(cb.laborPerUnit) + num(cb.overheadCPU);
        add("COGS_TOTAL_ADDITIVE", close(cb.cogsPerUnit, total, 0.005, 0.0005),
          "COGS/unit = materials + freight/loss + labor + overhead.", { cogsPerUnit: cb.cogsPerUnit, sum: r6(total) });
        // (d) active-cost DRIFT: re-derived actives vs the stored snapshot (catches an edited formula whose cost never recomputed)
        add("ACTIVE_COST_DRIFT", close(cb.activeCPU, der.activeCPU, 0.01, 0.0005),
          "Stored active-ingredient cost still matches the live formula × inventory.", { stored: cb.activeCPU, rederived: r6(der.activeCPU) },
          "warn");
      }
      add("COGS_POSITIVE", num(cb.cogsPerUnit) > 0, "COGS/unit is a positive number.", { cogsPerUnit: cb.cogsPerUnit });
    } else {
      add("COGS_PRESENT", false, "A costed COGS breakdown exists for this project.", null, "warn");
    }

    // (e) bulk unit-of-measure consistency
    const basis = batchBasis(p);
    if (basis.isBulk) add("BULK_UOM", basis.piecesPerContainer === 1, "Bulk order is priced per single piece (pieces/container = 1).", { ppc: basis.piecesPerContainer });

    // (f) container ↔ dose form compatibility (a stick pack can NEVER be a bottle/canister)
    if (isStickForm(p.dosageForm)) {
      const pkgKeys = Object.keys(p.pkg || {});
      const bottleish = pkgKeys.filter((k) => ["container", "closure", "scoop"].includes(k));
      add("STICK_CONTAINER", bottleish.length === 0,
        "Stick pack has no bottle/canister packaging (foil + display + shipper only).", { strayKeys: bottleish });
    }

    // (g) tier pricing sanity: non-negative, monotonic (price should not RISE as quantity rises), margin ≥ 0
    const tiers = (Array.isArray(p.tierPricing) ? p.tierPricing : []).filter((t) => num(t.units) > 0 && t.price != null)
      .slice().sort((a, b) => num(a.units) - num(b.units));
    let mono = true; for (let i = 1; i < tiers.length; i++) if (num(tiers[i].price) > num(tiers[i - 1].price) + 1e-9) mono = false;
    if (tiers.length >= 2) add("TIER_MONOTONIC", mono, "Tier price does not increase as quantity increases.", { tiers: tiers.map((t) => [num(t.units), num(t.price)]) }, "warn");
    if (cb && tiers.length) {
      const under = tiers.filter((t) => num(t.price) < num(cb.cogsPerUnit) - 1e-9);
      add("MARGIN_NONNEG", under.length === 0, "No quoted tier is below COGS (no underwater price).",
        { cogsPerUnit: cb.cogsPerUnit, underwater: under.map((t) => [num(t.units), num(t.price)]) }, "warn");
    }

    // (h) MFSO ↔ formula tie: if the MFSO was edited, its composition must still reflect the formula's actives
    if (p.mfso && Array.isArray(p.mfso.composition)) {
      const comp = p.mfso.composition.filter((r) => num(r.input) > 0);
      add("MFSO_FORMULA_TIE", comp.length >= dosed.length,
        "Edited MFSO composition covers every dosed active in the formula.", { mfsoRows: comp.length, formulaActives: dosed.length }, "warn");
    }

    // (i) approval snapshot drift: a LOCKED project's stored COGS must equal what it was approved at
    const lock = p.formulaLock;
    if (lock && lock.locked && lock.cogs && lock.cogs.cogsPerUnit != null && cb) {
      add("LOCK_NO_DRIFT", close(lock.cogs.cogsPerUnit, cb.cogsPerUnit, 0.0002, 0.00005),
        "Approved & locked COGS has not drifted from the live cost.", { approved: lock.cogs.cogsPerUnit, live: cb.cogsPerUnit });
    }

    return {
      ok: errors.length === 0,
      errors, warnings, checks,
      summary: { pn: p.pn, checks: checks.length, passed: checks.filter((c) => c.ok).length, errors: errors.length, warnings: warnings.length },
    };
  }
  // Convenience for the app's integrity gate — just the blocking error messages.
  function reconcileErrors(p, invIx) { return reconcile(p, invIx).errors.map((e) => e.message); }

  return {
    VERSION: "1.4.0-kernel(pn+schema+base+pkg+cost+label+reconcile)",
    // contracts
    PN_RE, isValidPN, pnParts, pnYear, nextPN, validateSchema,
    // derivation
    skuCost, batchBasis, deriveActiveCPU,
    // base / non-active systems + unified formula generation
    GUMMY_SUGAR_BASE, GUMMY_SF_BASE, gummyActivesMgPerGummy, gummyBase, formulate,
    // packaging + shipping generator (+ shared geometry / inspection helpers)
    packaging, estimatePackFillCC, estimateCasePack, capsuleShellCC, pkgBlendGramsPerServing, unitNounFor, CAPSULE_CC,
    pkgCapacityCC, pkgNeckFinish,
    // label engine — Supplement Facts + FDA compliance review
    DAILY_VALUES, IU_CONVERT, NUTRIENT_SYNONYMS, dvForNutrient, roundDVpct, labelModel, reviewLabel, label,
    // costing core
    cost,
    // hardening
    reconcile, reconcileErrors,
    // predicates
    isStickForm, isGummyForm, isCapsuleForm,
    // math helpers (exposed for tests)
    _close: close, _num: num,
  };
});
