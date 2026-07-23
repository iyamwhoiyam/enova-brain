# AGENTS.md — Enova Brain

> Operating contract for any AI agent working on **Enova Brain**, the single-file React/JSX ERP for
> Enova Science (GMP supplement contract manufacturer). Read this file first, every session. It encodes
> the rules, the build/verify loop, the architecture, and the invariants that must never regress — so they
> are retrievable from the repo, not re-learned from chat. When local truth here conflicts with a general
> habit, **this file wins.**

---

## 1. Operating loop (do this every session)

1. **Read this file + the architecture** before touching anything.
2. **Audit before editing.** For any non-trivial change, confirm what already exists so you *extend* rather
   than duplicate or drop. Never remove a working feature or data to fix something else.
3. **Back up first.** Copy the app to `backups/` with a timestamp before edits (workspace backups are
   intra-session only — see §7 durability).
4. **Edit surgically.** Smallest change that fixes the problem. Don't rewrite working code.
5. **Verify** (§3) after *every* edit: Babel parse OK + line count + brace/bracket/paren balance, then the
   full suite, then a browser drive for UI changes.
6. **Prove in the real environment**, not just unit consistency: SSR/logic tests *and* a Playwright drive of
   the offline bundle; for DB changes, a live-DB transaction test (rolled back) + `get_advisors`.
7. **Be direct and accountable.** State what changed and why. Lead with the fix. Verify claims against the
   file before asserting them.

## 2. Non-negotiable rules

- **Formula rule.** Extract only what is stated. Never invent ingredients, quantities, or prices. All costs
  trace to MISys or the Master Bid Template. **Tier pricing is always manual.**
- **Human-in-the-loop.** Every generated item (formula, quote, SO/MO/BOM/MFSO, label) is reviewed and
  approved by an Enova employee before it is saved to the database or sent to a customer.
- **Never ship code that fails to parse.** A clean Babel parse gates every change.
- **Project numbers stay chronological and organized.** New projects assigned in order.
- **Costs and inventory are authoritative, not invented.** On-hand moves only through the transactional RPCs
  (§5); never hand-write stock numbers.

## 3. Build & verify (exact commands)

The app source is **`Enova_Brain_Studio_2.html`**. Everything else is derived.

```
# after EVERY edit — must print "BABEL PARSE: OK"; report the line count
node verify.js | grep -iE 'BABEL PARSE|Total lines'

# brace/bracket/paren balance — extract the babel <script> and count.
# The REAL signal is 0/0/0 on the script body (matches the pre-edit backup).
# NOTE: verify.js's crude whole-file counter reports Δ1/Δ0/Δ-1 — that is JSX-text
# noise (literal braces/parens inside JSX), NOT an imbalance. Trust the script-scoped 0/0/0.

# full regression suite — must end with "ALL <n> CHECKS PASSED" (currently 47)
bash run_all_tests.sh

# sync the deploy file (see §4) and rebuild the offline test bundle
node build_prod.js && cp index.prod.html index.html   # precompiled deploy build (npm run build)
node build_offline.js
```

For UI changes, also run a Playwright drive of `index.offline.html` (headless Chromium at
`/opt/pw-browsers/chromium`; `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; never `playwright install`).

**Report format after an edit:** line count, and brace/bracket/paren balance (script-scoped).

## 4. Repo layout & deploy convention

| File | Role |
| --- | --- |
| `Enova_Brain_Studio_2.html` | **The source.** ~11,573 lines. React 18 + Babel-standalone, single file. Edit this. |
| `index.html` | **The deploy file** (GitHub → Vercel). The **precompiled production build** of the source — JSX compiled ahead of time, babel-standalone removed (faster load, no Babel console warnings). Build with `node build_prod.js && cp index.prod.html index.html`. NOT a raw copy of the source. |
| `index.offline.html` | Fully-inlined offline bundle (react/xlsx/decimal inlined) built from `index.prod.html` by `build_offline.js`. **This is what the browser tests load.** Git-ignored artifact. |
| `index.prod.html` | Precompiled build from `build_prod.js`; copied to `index.html` for deploy. Git-ignored artifact. |
| `ci_verify.js` | Portable CI gate: rebuilds from source, proves `index.html` is that exact precompiled build. |
| `verify.js`, `run_all_tests.sh`, `test_*.js`, `shoot_*.js` | Verification harness. |
| `backups/` | Timestamped app backups (ephemeral — §7). |

**Deploy = `node build_prod.js && cp index.prod.html index.html` (npm run build), commit `index.html` + source, Vercel serves `index.html`.** DB migrations are applied separately via the Supabase MCP; there is no DB deploy step tied to the frontend push.

## 5. Architecture (what the wiring actually is)

**Two-layer, CQRS-lite.** Supabase project `rjvcynsojdgyckhgrlfd` (Postgres + RLS + realtime + Auth + Storage).
The sandbox cannot reach supabase.co directly — **use the Supabase MCP** (`execute_sql`, `apply_migration`,
`get_advisors`, `list_migrations`).

- **Document truth:** `studio_projects` (JSONB blobs, one per project) is the single source of truth for
  commercial data. The app loads it once + a realtime subscription; writes via `setProjects` → upsert with
  `rev` optimistic locking + central dedupe.
- **Projected read-model:** `erp_refresh_all()` / `erp_refresh_projections()` project JSONB into relational
  `erp_*` tables + `erp_v_*` reporting views (eventual consistency, refresh-based). The Dashboard and reports
  read these views. **The refresh functions do NOT touch the transactional tables below** — they are safe.
- **Transactional system of record (inventory + purchasing + MO):** `erp_inventory_items` (on-hand),
  `erp_inventory_transactions` (immutable ledger, carries `actor` + `lot_no`), `erp_inventory_lots`,
  `erp_purchase_orders` / `erp_po_lines`, `erp_manufacturing_orders` / `erp_mo_consumption`. These are **real
  write-targets**, moved ONLY through six SECURITY DEFINER RPCs — the only write path (tables carry no write
  RLS policy):
  `erp_inv_adjust`, `erp_po_create`, `erp_po_receive`, `erp_mo_create`, `erp_mo_issue`, `erp_mo_shortage_po`.
  Each requires an authenticated **admin** actor, writes a ledger row, and is atomic. Issue is **FEFO** and
  blocks on shortage; over-receipt and negative-underflow are blocked. The app calls them via the `scRpc()`
  wrapper on the **Stock Control** page (§63 in source).
- **Auth/roles:** admin-write / viewer-read via RLS + `studio_roles` + `is_studio_admin()`. Admins:
  carlos, tong, marina, nick, jonathan, ryan, jbradfield @enovascience.com.
- **Part-11:** `studio_audit` (append-only, hash-chained) + the inventory ledger are the tamper-evident record.

**DB change protocol:** `list_tables` first → `apply_migration` (never hand-edit prod DDL casually) →
`get_advisors` (security + performance) after every DDL. The 6 transactional RPCs intentionally show as
"authenticated SECURITY DEFINER" WARNs — that is the authorized, admin-enforced, actor-logged write API and is
expected. **Leaked-password protection is a Supabase dashboard toggle** (Auth → Policies) — it cannot be set
via SQL; flag it, don't try to migrate it.

## 6. Invariants that must never regress

- **Golden thread:** formula ↔ COGS ↔ signed-MFSO must stay reconciled. The commit gate blocks production docs
  when the signed formula drifts from the current one. Compare against the MFSO **Label Claim** (not Input-mg,
  which carries overage).
- **Pipeline classification** (cGMP-accurate): `PROSPECT` / `COMMITTED` (won + authorized; pre-production
  cGMP docs BOM·MO·MMR/MBR are built here) / `PRODUCTION` (batch actually running: executed MBR + QC) /
  `ONHOLD` / `DELIVERED` / `ARCHIVED` (dead quotes — hidden from live pipeline, fully searchable, formulas
  retained in the Formula Library). **MFSO-signed ≠ In Production.**
- **Stage integrity (§70):** a stage is a *claim*, not proof. The WIP board places each project at
  `effectiveStage(p)` — the highest ladder rung whose artifacts (real product name / dosed formula /
  costed COGS / signed MFSO, cumulative per `STAGE_REQUIRES`) actually pass — caps **downward only**, and
  keeps the reported stage as a hover note + a red `⚠ needs …` flag. `stageAdvanceGate` blocks dragging a
  card into MFSO/PO Submitted/In Production without the prereqs (admin override → `logAudit` STAGE
  OVERRIDE). On Hold / Completed / Cancelled are off-ladder — never capped or gated. **Never invent a
  product name, formula, or cost to clear a gate.** Details: `Enova_Stage_Integrity_Shipped.md`.
- **New JSONB fields** get a `FORMULATION_DEFAULTS` entry + a `migrateProject` guard so old blobs upgrade
  cleanly. Never assume a field exists.
- **Test-harness SSR quirks:** install the `React.useState` override BEFORE `vm.runInContext` (the app captures
  `const {useState}=React` early); SSR inserts `<!-- -->` between adjacent text nodes and escapes `&`→`&amp;` —
  write test regexes to tolerate both.

## 7. Durability (read this — the workspace is ephemeral)

The cloud workspace (`/root`, including `backups/`) is reclaimed when the session ends. The **durable** homes are:
(1) the **GitHub repo** that deploys `index.html` to Vercel, and (2) this **Claude Project** (docs persist across
sessions). Therefore: **commit the source + this AGENTS.md to the GitHub repo** — that is the canonical copy.
Do not treat `backups/` as a safety net beyond the current session.

## 8. Context routing (find the right doc, don't load everything)

The Project holds ~60 `claude/*.md` docs. Route to the relevant one instead of reading all:

- Transactional inventory/purchasing/MO → `Enova_Transactional_SystemOfRecord_Shipped.md`
- Document Vault (controlled docs / storage / retrieval) → `Enova_Document_Vault_Shipped.md`
- Golden thread / commit gate → `Enova_GoldenThread_CommitGate_Shipped.md`, `Enova_GoldenThread_Reconciliation_*`
- Pipeline lifecycle → `Enova_Pipeline_Lifecycle_Shipped.md`
- Dashboard / reporting views → `Enova_Executive_Dashboard_Shipped.md`
- Sales intake → `Enova_Sales_Intake_Gate_Shipped.md`
- Comms + QC/batch → `Enova_Comms_and_QC_Shipped.md`
- WIP stage integrity (cap placement + flag + advance gate) → `Enova_Stage_Integrity_Shipped.md`
- Formula engine / cost core → `Enova_Formulation_Generator_Engine.md`, `Enova_Brain_Kernel_Architecture.md`
- Schema / migration → `Enova_Relational_Schema_Phase1.md`, `Enova_Relational_Migration_and_Slice1.md`

Read the doc whose job matches the task. Add a second only for a genuinely distinct concern.
