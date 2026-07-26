# Enova Brain — Backend Kernel Architecture & Build Guide

_Author: Enova Brain build session · Version of record: kernel `1.0.0-kernel(pn+schema+reconcile)` · App suite: 27 checks green._

This is the engineering blueprint for the "Enova Brain": the algorithmically hardened, deterministic backend that every Enova generator — Formulation, Quote, Label Review/Correction, SO, MFSO, BOM, MO, MMR — is built to trust. It describes what exists today, why it is shaped the way it is, and the exact roadmap to the "perfect Enova Brain." UI is deliberately out of scope here; this document is about the computational core.

## 1. The problem the Brain solves

Enova's bottleneck is the human time between a customer request and a defensible, production-ready set of documents. Today that time is spent re-deriving the same numbers by hand across MISys, QuickBooks, spreadsheets, and Word templates, and — worse — spent catching the errors that creep in when those numbers are copied between systems. A wrong project number (P262112), a stick pack quoted in a bottle, a COGS that no longer ties to the formula, a tier priced under cost: each of these is a silent, expensive mistake that a person currently has to notice.

The Brain's job is to make those mistakes structurally impossible to ship. It does that with one principle: **every money and mass figure is derived once, deterministically, from the formula and live inventory — and then independently re-derived and cross-checked before anything is quoted, signed, or produced.** Nothing is trusted because "the spreadsheet said so." The Brain re-computes from first principles and refuses to let an incoherent bundle through.

## 2. Design tenets (why this is "hardened")

The kernel is governed by five non-negotiable properties. Every future addition must preserve all five.

**Deterministic and pure.** Same inputs always produce the same outputs. No hidden state, no reliance on the clock or randomness inside the math (the only clock touch is `pnYear()`, and it is injectable via an argument so tests are reproducible). This is what makes the numbers auditable and the golden tests meaningful.

**Portable — one core, three runtimes.** The kernel is a single UMD module with no dependency on the DOM, React, the network, or any AI. The identical file runs embedded in the browser app (`window.EnovaBrain`), in Node for CI and any future Mac-mini server process (`require`), and inside a Supabase edge function. There is exactly one implementation of each rule, so the browser, the server, and the database can never disagree.

**Independently verifying.** Reconciliation does not re-read the app's own computation and rubber-stamp it. It re-derives the actives cost, the batch basis, the additive cost stack, and the container/UOM rules from the raw formula and the inventory index, then compares. A stale snapshot — an edited formula whose cost never recomputed — is caught precisely because the two paths are independent. This is defense in depth, not a checksum.

**Total, typed failure.** The kernel never throws on bad data; it reports. Every check carries a stable machine `code`, a human-readable `message`, and a structured `detail`. Callers decide what to do with a failure (block, warn, override-with-audit). This keeps the math layer free of policy and the policy layer free of math.

**Versioned and golden-locked.** Any rule change bumps `VERSION`, and `test_enova_brain.js` locks behavior with a clean-passes-everything fixture plus one injected fault per invariant. A regression cannot merge silently.

## 3. The layered model

The Brain is organized as concentric layers. Inner layers never depend on outer ones. This is the map to keep in your head when deciding where a new piece of logic belongs.

```
        ┌───────────────────────────────────────────────────────────────┐
   L4   │  ADAPTERS  — browser embed · Node CI · Supabase edge · UI glue │  (impure edge: DOM, network, AI image-gen)
        ├───────────────────────────────────────────────────────────────┤
   L3   │  RECONCILE — independent re-derivation + typed cross-checks    │  ◀── the hardening core (exists)
        ├───────────────────────────────────────────────────────────────┤
   L2   │  GENERATORS — formula · costing · quote · MFSO/SO/BOM/MO · label│  (partly in app today; migrating in)
        ├───────────────────────────────────────────────────────────────┤
   L1   │  DERIVATION — batchBasis · deriveActiveCPU · skuCost           │  ◀── exists
        ├───────────────────────────────────────────────────────────────┤
   L0   │  CONTRACTS — PN rules · schema · units · rounding · tolerances │  ◀── exists
        └───────────────────────────────────────────────────────────────┘
```

**L0 — Contracts.** The vocabulary the whole system agrees on: the canonical project number (`P{YY}{NNN}`), the structural schema of a project, the money/mass units, the rounding rule (`r6`), and the closeness tolerance (`close`, relative 0.5% or absolute $0.0001). Everything above trusts these definitions and nothing redefines them.

**L1 — Derivation.** Pure functions that turn a project plus an inventory index into the primitive figures: the bulk-aware batch basis (`batchBasis`), the effective per-unit SKU cost with per-project override (`skuCost`), and the re-derived active-ingredient cost per costing unit (`deriveActiveCPU`). These mirror the app's `docBatchBasis` and `calcIng` exactly — that is deliberate, because L3 uses them as the independent second opinion.

**L2 — Generators.** The document builders. Today these still live inside the React file (`FormulationEditor`, `buildMFSO`, `docPackagingRows`, the SO/BOM/MO printables). The roadmap in §7 moves their *pure* cores down into the kernel so the app becomes a thin renderer over kernel output.

**L3 — Reconciliation.** The hardening core (`reconcile`), described in detail in §5. This is what makes the Brain "hardened" rather than merely "organized."

**L4 — Adapters.** The only impure code. The browser embed that exposes `window.EnovaBrain`; the Node test harness; a future edge function; and the genuinely non-deterministic edges like label image generation, which are pushed all the way out here so the deterministic core stays pure.

## 4. What exists today — kernel v1.0.0

The file `enova_brain.js` (embedded in the app as `<script id="enova-brain">`) currently implements L0, L1, and L3.

Contracts (L0): `PN_RE`, `isValidPN`, `pnParts`, `pnYear`, `nextPN`, `validateSchema`. The project number is exactly `P` + 2-digit year + 3-digit sequence. Malformed numbers are ignored for sequencing and never generated; `nextPN` returns the current-year max sequence + 1, guaranteed free. `validateSchema` answers "is this even a well-formed project before we cost it?" — array shapes, non-negative doses/potencies/prices, sane overrides.

Derivation (L1): `skuCost(alt, project, invIx)` (override beats inventory), `batchBasis(project)` (bulk ⇒ 1 piece/unit; retail ⇒ pieces = servingSize × servings), `deriveActiveCPU(project, invIx)` (mg-per-serving from input × overage ÷ potency, costed against live inventory, scaled to the costing unit).

Reconciliation (L3): `reconcile(project, invIx)` and the convenience `reconcileErrors`. This is the catalog in §5.

The public surface is intentionally small and stable: 17 exports, all pure. It loads identically under Node (`require`) and in the browser (`window.EnovaBrain`), proven by `test_enova_brain.js` and an in-browser probe.

## 5. The reconciliation invariant catalog

`reconcile` returns `{ ok, errors, warnings, checks, summary }`. Each entry is a typed check with a stable code. This is the contract the app's integrity gate consumes, and the reference for anyone adding a new invariant.

| Code | Severity | What it proves | How it re-derives |
|------|----------|----------------|-------------------|
| `PN_FORMAT` | error | The project number is canonical `P{YY}{NNN}`. | `isValidPN` on the stored `pn`. |
| `FORMULA_HAS_ACTIVES` | error | At least one dosed ingredient exists. | Count of ingredients with `inputMg > 0`. |
| `SKU_RESOLVE` | error | Every dosed ingredient resolves to a priced MISys SKU (else COGS is understated). | `deriveActiveCPU` row-by-row; any dosed row with no cost is flagged. |
| `COGS_MATERIALS_ADDITIVE` | error | Direct materials = active + base + shell + packaging. | Independent sum of the stored parts vs stored `materialsCPU`. |
| `COGS_TOTAL_ADDITIVE` | error | COGS/unit = materials + freight/loss + labor + overhead. | Independent sum vs stored `cogsPerUnit`. |
| `COGS_POSITIVE` | error | COGS/unit is a positive number. | Direct. |
| `BULK_UOM` | error | A bulk order is priced per single piece (pieces/container = 1). | `batchBasis` on the stored breakdown. |
| `STICK_CONTAINER` | error | A stick pack carries no bottle/canister packaging (foil + display + shipper only). | Scan `pkg` keys for `container`/`closure`/`scoop`. |
| `ACTIVE_COST_DRIFT` | warn | The stored active cost still matches the live formula × inventory. | `deriveActiveCPU` vs stored `activeCPU`. |
| `TIER_MONOTONIC` | warn | Tier price does not rise as quantity rises. | Sort tiers by units, check non-increasing price. |
| `MARGIN_NONNEG` | warn | No quoted tier is below COGS (no underwater price). | Compare each tier price to `cogsPerUnit`. |
| `MFSO_FORMULA_TIE` | warn | An edited MFSO still covers every dosed active. | Count MFSO composition rows vs dosed actives. |
| `LOCK_NO_DRIFT` | warn/info | An approved & locked COGS has not drifted from the stored live cost. | Compare `formulaLock.cogs` to `cogsBreakdown`. |
| `COGS_PRESENT` | warn | A costed breakdown exists at all. | Presence check. |

Two correctness notes that any maintainer must preserve:

The additive tie-outs (`COGS_MATERIALS_ADDITIVE`, `COGS_TOTAL_ADDITIVE`, `ACTIVE_COST_DRIFT`) only run when the breakdown is **decomposed** — that is, when `activeCPU` is an actual number (zero counts). An imported cost snapshot carries a rolled `materialsCPU` with null component parts; there is nothing to independently decompose, so these checks are skipped for it rather than false-tripping on 0-vs-materials. This is the difference between a live formulation breakdown and an import stub, and it is load-bearing.

The tolerance is relative-or-absolute on purpose: `close(a, b)` passes if the values are within $0.0001 absolutely **or** within 0.5% relatively. Tight enough to catch a real transcription or staleness error, loose enough to survive floating-point noise across the browser/Node boundary.

## 6. How it wires into the app (the policy boundary)

The kernel computes; the app decides. Reconciliation is merged into `validateProject` as an **additive** hardening layer, behind three guardrails so it never over-blocks:

1. **No double messages.** Checks `validateProject` already performs (no-dose, unmatched/uncosted SKU, malformed PN) are dropped from the merge — the app's own wording governs those.
2. **Legacy PN stays a warning.** A malformed project number is flagged, never blocked (§39 policy: renaming a legacy record could break references). `PN_FORMAT` is therefore not escalated.
3. **Only genuine incoherence blocks.** Just four codes escalate to blocking errors — `COGS_MATERIALS_ADDITIVE`, `COGS_TOTAL_ADDITIVE`, `STICK_CONTAINER`, `BULK_UOM` — all of which the live engine makes impossible in normal operation, so they fire only on a corrupted or stale snapshot. Everything else (drift, tier, margin, MFSO ties, lock drift) is advisory.

Blocking errors flow through the existing money-gate (`passIntegrityGate`): a clean project proceeds silently; a blocked one demands an explicit admin override that is written to the audit trail with the exact reasons. No customer gets a quote and no production run is authorized on an incoherent bundle without a logged human decision. The merge is wrapped in a `try/catch` and guarded on `window.EnovaBrain` being present, so the app degrades gracefully (and Node unit harnesses that slice out `validateProject` are unaffected).

## 7. Roadmap — the unified `compute()` facade

Today the pure logic is split: L0/L1/L3 in the kernel, L2 (the generators) still in the React file. The target state is a single kernel entry point that returns the entire bundle, so the app and any server share one source of truth and one call:

```js
// Target facade — one deterministic call, the whole bundle out.
EnovaBrain.compute(project, ctx) -> {
  formula,        // the turnkey formulation (actives + system + balance), per dose form
  costing,        // full COGS decomposition (the cogsBreakdown, re-derived, not trusted)
  quote,          // tier table with margins (tier PRICES remain manual input, never invented)
  documents: {    // pure data models the renderers turn into printable HTML
    mfso, so, bom, mo, mmr
  },
  label,          // LabelSpec + review findings + correction plan (see §8)
  validation,     // validateSchema + readiness
  reconciliation, // the §5 catalog result over the whole bundle
}
// ctx carries the impure inputs the core is not allowed to fetch itself:
// { invIx, masterBidConstants, now, actor }.
```

Migration sequence, smallest-risk first, each step behind the 27-check suite and a byte-for-byte parity test against current output:

**Step A — costing core.** Move the `FormulationEditor` cost math (`calcIng`, the `materialsCPU`/`dmExtraCPU`/`cogsPerUnit` stack, the Master Bid call) into `EnovaBrain.cost(project, ctx)`. The React component becomes a thin `useMemo` over it. `deriveActiveCPU` already mirrors this, so parity is the acceptance test.

**Step B — formula core.** Fold `window.EnovaFormulator` in as `EnovaBrain.formulate(...)`. It is already a pure UMD engine; this is mostly re-homing and a shared version stamp.

**Step C — document models.** Refactor each printable (SO/BOM/MO/MMR) the way MFSO was already refactored: a pure `xModel(project, ctx)` in the kernel, and a dumb renderer in the app. MFSO is the reference implementation (`mfsoDefaults` → `mfsoModel` → renderer).

**Step D — quote core.** Move tier assembly and margin math into `EnovaBrain.quote(...)`. Preserve the hard rule: **tier prices are always manual**; the kernel computes margins and flags underwater tiers, but never invents a price.

**Step E — the facade.** Once A–D land, `compute()` is just orchestration: formulate → cost → quote → build documents → review label → reconcile the whole bundle. At that point the app calls `compute()` once per project and renders the result, and the same call backs a Supabase edge function for headless/API use.

The discipline for every step: extract only what is stated, never invent an ingredient/quantity/price, trace every cost to MISys or the Master Bid Template, keep tier pricing manual, and gate each move on the full suite plus a parity test.

## 8. The missing generator — Label Review / Correction engine

Every other generator has a home; the label engine does not yet. Here is its design, built to the same tenets. The key architectural decision: **the rule-checking is deterministic and lives in the kernel; the image generation is a non-deterministic adapter concern pushed out to L4.** The Brain decides *what is wrong and what the corrected label must say*; an adapter renders the pixels.

**The model — `LabelSpec`.** A structured, machine-checkable representation of a Supplement Facts label, parsed once from the customer's artwork/PDF (parsing itself is an L4 adapter; the parsed result is pure data the kernel checks):

```
LabelSpec {
  productName, netQuantity, servingSize, servingsPerContainer,
  supplementFacts: [ { name, amountPerServing, unit, dailyValuePct|null, symbolDagger } ],
  otherIngredients: [ name ],
  allergens: [ name ],
  claims: [ text ],                 // structure/function claims
  manufacturerInfo: { name, address },
  warnings, directions, storage, lotAndExpiryPresent
}
```

**The checks — `reviewLabel(labelSpec, project, rules)`** returns the same typed `{ errors, warnings, checks }` shape as `reconcile`, so it composes into `compute()` and the integrity gate for free. The invariants, drawn from FDA 21 CFR 101.36 (Supplement Facts), 101.4/101.36(b) (ingredient and allergen labeling), FALCPA, and NSF/GMP expectations:

- `LABEL_FACTS_TIE` — every dosed active in the approved formula appears in Supplement Facts at the matching amount (this is the reconciliation hook: the label must tie to the *formula the Brain costed*, not to whatever the artwork claims).
- `LABEL_SERVING_TIE` — serving size and servings/container on the label match the project's `servingSize`/`servingsPerUnit`.
- `LABEL_DV` — a %DV is present for every nutrient with an established Daily Value, and the dagger footnote is present exactly when a nutrient has no DV.
- `LABEL_UNITS` — units are the FDA-required ones (mg/mcg/g, IU only where still permitted) and quantitative amounts are non-blank.
- `LABEL_ALLERGENS` — FALCPA "Contains" statement covers any of the major allergens implied by the ingredient list.
- `LABEL_CLAIMS` — structure/function claims carry the DSHEA disclaimer ("This statement has not been evaluated…") and no disease claim is present.
- `LABEL_IDENTITY` — statement of identity, net quantity of contents, and manufacturer/distributor name & address are present.
- `LABEL_FORMAT` — required ordering and the "Supplement Facts" heading are present; other-ingredients listed in descending predominance.

**The correction plan.** For every failing check, the engine emits a structured, deterministic instruction — old value, required value, citation — as data. That plan is what an L4 image-generation adapter consumes to render a corrected label, and what a human reviewer approves. The kernel never generates an image and never approves; it produces the auditable diff. This keeps the compliance logic testable with golden fixtures (a known-bad label trips a known set of codes) while the pixel-rendering stays at the impure edge where non-determinism is acceptable.

This design means label correctness is enforced by the *same* independent re-derivation philosophy as cost: the label must tie to the approved formula, or the bundle does not pass.

## 9. Testing & release discipline

`test_enova_brain.js` is the kernel's golden suite: a clean, internally-consistent fixture that passes every invariant with zero errors and zero warnings, plus one injected fault per invariant that must trip exactly its code (wrong additivity, cost drift, malformed PN, stick-in-a-bottle, underwater margin, MFSO drop, lock drift, unresolved SKU, bulk UOM, and the import-stub non-false-trip). It is check #27 in `run_all_tests.sh`.

Release rules: bump `VERSION` on any behavior change; a clean Babel parse (`BABEL PARSE: OK`) is the structural gate (the verify.js bracket-balance line is a known false positive over literal characters and is not the signal); the full 27-check suite must be green; and the real-browser render gate must confirm the app mounts with `window.EnovaBrain` live and no page errors. Keep a verified backup before any embed. The app is deployed by pushing `index.html` to GitHub → Vercel.

## 10. Deployment topology — one file, three runtimes

The same `enova_brain.js` serves three homes without modification. In the **browser**, it is embedded as `<script id="enova-brain">` and attaches to `window.EnovaBrain`, loaded before the Babel app block so it is ready when the app first renders. In **Node**, it is `require`d by the test suite and by any future Mac-mini automation. In **Supabase**, the identical module backs an edge function for headless quote/document generation and server-side validation, so a document produced by an API call is guaranteed to reconcile to the same invariants as one produced in the browser. One implementation, one set of rules, three surfaces that can never drift apart — which is the whole point of a Brain.
