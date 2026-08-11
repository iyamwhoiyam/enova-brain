# AGENTS.md — Enova Brain

> Operating contract for any AI agent working on **Enova Brain**, the React/JSX ERP for Enova Science
> (GMP supplement contract manufacturer). Read this file first, every session. It encodes the rules, the
> **outcome-based** build/verify loop, the architecture, and the invariants that must never regress — so
> they are retrievable from the repo, not re-learned from chat. When local truth here conflicts with a
> general habit, **this file wins.**
>
> **v2.0 — 2026-08-10.** Modernized: build/verify/deploy (§3–§4) are now tool-agnostic *principles*, not
> fixed commands, so newer tooling (Supabase MCP, cloud sandbox + Playwright, a future bundler) is
> allowed. The **safety + data-integrity invariants (§2, §6) and the data/compliance architecture (§5)
> stay strict.** Changelog at the end.

---

## 1. Operating loop (do this every session)

1. **Read this file + the architecture** before touching anything.
2. **Audit before editing.** For any non-trivial change, confirm what already exists so you *extend*
   rather than duplicate or drop. Never remove a working feature or data to fix something else.
   *(Cautionary tale: the sectioned nav rail shipped once, was lost because a session never committed,
   and had to be rebuilt. Audit + commit.)*
3. **Back up first.** Copy the app to `backups/` with a timestamp before edits (workspace backups are
   intra-session only — see §7 durability).
4. **Edit surgically.** Smallest change that fixes the problem. Don't rewrite working code.
5. **Verify to the bar in §3** after *every* edit — parse-clean, regression, real-environment render.
   The *tools* may vary; the *bar* does not.
6. **Prove in a real environment**, not just unit consistency (§3.3). For DB changes, a live-DB
   transaction test (rolled back) + `get_advisors`.
7. **Be direct and accountable.** State what changed, why, and *which tooling proved it*. Verify claims
   against the file before asserting them.

---

## 2. Non-negotiable rules (unchanged — these never relax)

- **Formula rule.** Extract only what is stated. Never invent ingredients, quantities, or prices. All
  costs trace to MISys or the Master Bid Template. **Tier pricing is always manual.**
- **Human-in-the-loop.** Every generated item (formula, quote, SO/MO/BOM/MFSO, label) is reviewed and
  approved by an Enova employee before it is saved to the database or sent to a customer.
- **Never ship code that fails to parse.** A clean parse gates every change (§3.1).
- **Project numbers stay chronological and organized.** New projects assigned in order via the
  canonical `uniquePN(projects, nextPN(projects))` path.
- **Costs and inventory are authoritative, not invented.** On-hand moves only through the transactional
  RPCs (§5); never hand-write stock numbers.

These five are business/compliance rules, independent of how the frontend is built. Modernizing tooling
or architecture (§4) never overrides them.

---

## 3. Build & verify — the OUTCOME BAR (tool-agnostic)

A change ships only when **all three gates pass**. *How* you clear each gate may vary with the
environment; the gate itself is mandatory. State which tool you used for each.

### 3.1 Parse-clean (hard gate)
The app must parse/compile with **zero errors**, and the edited script's brace/bracket/paren balance
must match the pre-edit baseline. Any of these is valid proof:
- **Repo harness (preferred when present):** `node verify.js | grep -iE 'BABEL PARSE|Total lines'`.
- **Equivalent (when the harness isn't in the working set):** compile the `<script type="text/babel">`
  block with `@babel/core` + `@babel/preset-react` (**classic runtime** — automatic runtime injects
  `import` and breaks the in-browser build) and count balance. A ~30-line local `verify_local.js` does
  this and is an accepted substitute.

Report line count + script-scoped brace/bracket/paren balance after every edit.

### 3.2 Regression (hard gate)
- **Repo harness (preferred):** `bash run_all_tests.sh` — must end with `ALL <n> CHECKS PASSED`
  (count grows over time; don't hardcode it). Add/extend a `test_*.js` for the surface you changed.
- **Equivalent (harness absent):** run an equivalent regression/smoke that exercises the changed
  surface and **log exactly what was and wasn't covered** — never imply full coverage you didn't run.
  When the harness is later available, run it before deploy.

### 3.3 Real-environment render (hard gate)
Prove it renders and runs in a real browser with **zero uncaught page errors**, asserting the changed
surface. Any of these is valid:
- **Repo Playwright drive of `index.offline.html`** (headless Chromium at `/opt/pw-browsers/chromium`;
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; never `playwright install`).
- **Cloud offline-bundle drive (blessed):** build an offline bundle — swap CDN `<script src>` for local
  UMD (React 18, `@babel/standalone` **pinned to the app's version, currently 7.23.5**, Decimal, XLSX),
  **drop the Supabase + mammoth tags** so `sb` is null → the app boots on the embedded seed — serve it
  over **HTTP** (file:// blocks `crossorigin` scripts), and drive it headless. Assert the changed UI +
  collect `pageerror`/`console.error`. *(This is the method that caught a real hooks-order bug this
  session; it is a first-class equivalent to the repo harness, not a fallback of last resort.)*

For DB/DDL changes, add: a live-DB transaction test (rolled back) + `get_advisors` after every migration.

> **Principle:** the bar is *parse-clean + regression + real render, zero page errors*. Reach it with
> whatever equivalent tooling the environment offers. Do not block work because one named script isn't
> present; do not claim a gate you didn't actually clear.

### 3.4 Fresh-checkout harness setup (learned 2026-08-10)
On a clean clone, do this **before** `run_all_tests.sh` or the browser tests fail for environment
reasons, not code:
- **Build artifacts first:** `node build_prod.js && cp index.prod.html index.html && node build_offline.js`.
  The `shoot_*` browser tests load `index.offline.html`, which derives from `index.prod.html`; without it
  they error out.
- `mkdir -p backups shots` — the `mfso editable model` test scandirs `backups/`.
- **Browser-revision mismatch:** if the pinned `playwright` wants a Chromium revision the machine doesn't
  have, do NOT `playwright install` (disabled here). Symlink instead, e.g.
  `mkdir -p ~/pw && ln -s <present chromium_headless_shell dir> ~/pw/chromium_headless_shell-<expected-rev>`
  (and `chromium-<rev>`), then run with `PLAYWRIGHT_BROWSERS_PATH=~/pw`.
- **9 referenced `test_*.js` are ABSENT from the repo itself** (not just a partial checkout): `ssr_test.js`,
  `test_slice1_unmatched_cost.js`, `test_slice1_ppgrid.js`, `test_golden_thread.js`, `test_intake.js`,
  `test_password.js`, `test_dashboard.js`, `test_library.js`, `test_comms_qc.js`. The suite skips them
  gracefully (skip ≠ fail), but they should be recovered or rewritten so those surfaces are actually gated.
- **The 3 `shoot_*` browser tests fixed 2026-08-10** — `fronts+scope`, `commitment gate`, `readiness`
  were failing because the UI had evolved (kanban board → `.wipm` matrix; Active/Archive/All scope →
  §59 lifecycle buckets defaulting to *Pipeline*). Selectors were realigned (`.board .col` → `.col-head-label`;
  `defaults to Active` → `defaults to Pipeline`; WIP collapse preamble → matrix-renders check). Suite is now
  **ALL 41 PRESENT CHECKS PASSED**. Keep tests aligned to the current DOM as the app evolves.

---

## 4. Repo layout, deploy & architecture evolution

### 4.1 Current files
| File | Role |
| --- | --- |
| `Enova_Brain_Studio_2.html` | **The source.** ~12.8k lines and growing. React 18 + Babel-standalone, single file. Edit this. |
| `index.html` | **The deploy file** (GitHub → Vercel). The **precompiled production build** of the source (JSX compiled ahead of time, babel-standalone removed). NOT a raw copy. |
| `index.offline.html` | Fully-inlined offline bundle built from `index.prod.html`. What the repo browser tests load. Git-ignored. |
| `index.prod.html` | Precompiled build from `build_prod.js`; copied to `index.html` for deploy. Git-ignored. |
| `ci_verify.js` | Portable CI gate: rebuilds from source, proves `index.html` is that exact precompiled build. |
| `verify.js`, `run_all_tests.sh`, `test_*.js`, `shoot_*.js` | Verification harness. |
| `backups/` | Timestamped app backups (ephemeral — §7). |

### 4.2 Deploy (current architecture)
`node build_prod.js && cp index.prod.html index.html` (npm run build) → commit **`index.html` + source**
→ Vercel serves `index.html`. DB migrations are applied separately via the Supabase MCP; there is no DB
deploy step tied to the frontend push. If you edited the source in an environment without `build_prod.js`,
say so and hand off the source so the precompiled `index.html` is regenerated in the repo before deploy —
**never deploy a source/`index.html` mismatch** (`ci_verify.js` exists to catch exactly that).

### 4.3 Architecture evolution is PERMITTED (new in v2)
Single-file + in-browser Babel is the **current** state, **not a permanent constraint.** Migrating toward
a **real build (e.g. Vite) and/or splitting components** into modules is explicitly allowed as a
deliberate, staged effort — provided **all** of these hold:
- the §3 gates still pass (parse/regression/real-render), by the migration's own tooling;
- the §2 rules and §6 invariants are untouched (they are UI-framework-independent);
- deploy still yields a single Vercel-served artifact (or an equivalent, documented pipeline);
- the migration is **checkpointed**: backup + a `claude/*.md` design doc + reversible commits, and a
  working build at each step (no long-lived broken `main`).

Until such a migration is deliberately undertaken and checkpointed, **edit the single file surgically**
(§1.4). Don't half-migrate as a side effect of a feature change.

### 4.4 Tooling now blessed
- **Supabase MCP** (`execute_sql`, `apply_migration`, `get_advisors`, `list_migrations`, `list_tables`)
  for all live-DB work — the sandbox can't reach supabase.co directly.
- **Cloud sandbox** (`npm`, Node, preinstalled Chromium, Playwright) as a first-class build/verify
  environment equivalent to the repo harness (§3).
- **Precompiled deploy** and a **future bundler** per §4.3.

---

## 5. Architecture (data & compliance — invariant)

**Two-layer, CQRS-lite.** Supabase project `rjvcynsojdgyckhgrlfd` (Postgres + RLS + realtime + Auth +
Storage). Use the **Supabase MCP** (the sandbox cannot reach supabase.co directly).

- **Document truth:** `studio_projects` (JSONB blobs, one per project) is the single source of truth for
  commercial data. Loaded once + realtime subscription; writes via `setProjects` → upsert with `rev`
  optimistic locking + central dedupe. A DB trigger also validates writes (`pn` match, no negative
  amounts/prices) — the client is not the only line of defense.
- **Projected read-model:** `erp_refresh_all()` / `erp_refresh_projections()` project JSONB into
  relational `erp_*` tables + `erp_v_*` reporting views (eventual consistency). Dashboards/reports read
  these views. The refresh functions do **not** touch the transactional tables below — they are safe.
- **Transactional system of record (inventory + purchasing + MO):** `erp_inventory_items`,
  `erp_inventory_transactions` (immutable ledger, carries `actor` + `lot_no`), `erp_inventory_lots`,
  `erp_purchase_orders`/`erp_po_lines`, `erp_manufacturing_orders`/`erp_mo_consumption`. Moved ONLY
  through six SECURITY DEFINER RPCs — the only write path (tables carry no write RLS policy):
  `erp_inv_adjust`, `erp_po_create`, `erp_po_receive`, `erp_mo_create`, `erp_mo_issue`,
  `erp_mo_shortage_po`. Each requires an authenticated **admin** actor, writes a ledger row, and is
  atomic. Issue is **FEFO** and blocks on shortage; over-receipt and negative-underflow are blocked.
  Called via the `scRpc()` wrapper on the **Stock Control** page.
- **Auth/roles:** admin-write / viewer-read via RLS + `studio_roles` + `is_studio_admin()`. Admin
  actors: carlos, tong, marina, nick, jonathan, ryan, jbradfield @enovascience.com (the viewer banner
  also names joseph — reconcile against `studio_roles`, which is authoritative).
- **Part-11:** `studio_audit` (append-only, hash-chained) + the inventory ledger are the tamper-evident
  record.

**DB change protocol:** `list_tables` first → `apply_migration` (never hand-edit prod DDL casually) →
`get_advisors` (security + performance) after every DDL. The 6 RPCs intentionally show as "authenticated
SECURITY DEFINER" WARNs — that is the authorized, admin-enforced, actor-logged write API and is expected.
**Leaked-password protection is a Supabase dashboard toggle** (Auth → Policies) — flag it, don't migrate it.

> This section is architecture *of the data and compliance layer*. It is invariant regardless of how the
> **frontend** is packaged (§4.3). A Vite migration changes none of it.

---

## 6. Invariants that must never regress

- **Golden thread:** formula ↔ COGS ↔ signed-MFSO must stay reconciled. The commit gate blocks
  production docs when the signed formula drifts from the current one. Compare against the MFSO **Label
  Claim** (not Input-mg, which carries overage).
- **Pipeline classification** (cGMP-accurate): `PROSPECT` / `COMMITTED` (won + authorized; pre-production
  cGMP docs BOM·MO·MMR/MBR built here) / `PRODUCTION` (batch actually running: executed MBR + QC) /
  `ONHOLD` / `DELIVERED` / `ARCHIVED` (dead quotes — hidden from live pipeline, searchable, formulas
  retained). **MFSO-signed ≠ In Production.**
- **Stage integrity (§70):** a stage is a *claim*, not proof. The WIP board places each project at
  `effectiveStage(p)` — the highest ladder rung whose artifacts actually pass, capping **downward only**
  — and keeps the reported stage as a hover note + a red `⚠ needs …` flag. `stageAdvanceGate` blocks
  dragging into MFSO/PO Submitted/In Production without prereqs (admin override → audited). On Hold /
  Completed / Cancelled are off-ladder. **Never invent a product name, formula, or cost to clear a gate.**
- **New JSONB fields** get a `FORMULATION_DEFAULTS` entry + a `migrateProject` guard so old blobs upgrade
  cleanly. Never assume a field exists.
- **React rules-of-hooks:** every hook (`useState`/`useMemo`/`useEffect`/…) must be called
  unconditionally, in the same order, on every render — **declare hooks before any early `return`.**
  *(This session: a memo placed after an `IntakePage` early return threw "Rendered more hooks than during
  the previous render"; the real-render gate in §3.3 caught it.)*
- **Test-harness SSR quirks:** install the `React.useState` override BEFORE `vm.runInContext`; SSR inserts
  `<!-- -->` between adjacent text nodes and escapes `&`→`&amp;` — write regexes to tolerate both.
- **In-browser Babel version pinning:** when replicating the browser build, pin `@babel/standalone` to the
  app's version (**7.23.5**). Newer versions default `preset-react` to the automatic runtime, which
  injects `import` and breaks the in-browser bundle.

---

## 7. Durability (the workspace is ephemeral)

The cloud workspace (`/root`, including `backups/`) is reclaimed when the session ends. The **durable**
homes are: (1) the **GitHub repo** that deploys `index.html` to Vercel, and (2) this **Claude Project**
(docs persist across sessions). Therefore: **commit source + `index.html` + this AGENTS.md every session
that changes them.** Uncommitted work is lost — this is exactly how the sectioned nav rail disappeared and
had to be rebuilt. `backups/` is not a safety net beyond the current session.

---

## 8. Context routing (find the right doc, don't load everything)

Route to the relevant `claude/*.md` instead of reading all:

- Nav rail / Pipeline page / Sales-Intake customer picker → `Enova_Nav_Sections_Pipeline_CustomerPicker_Shipped_2026-08-10.md`, `Enova_Nav_Rail_Shipped.md`
- Transactional inventory/purchasing/MO → `Enova_Transactional_SystemOfRecord_Shipped.md`
- Document Vault → `Enova_Document_Vault_Shipped.md`
- Golden thread / commit gate → `Enova_GoldenThread_CommitGate_Shipped.md`, `Enova_GoldenThread_Reconciliation_*`
- Pipeline lifecycle → `Enova_Pipeline_Lifecycle_Shipped.md`
- Dashboard / reporting views → `Enova_Executive_Dashboard_Shipped.md`
- Sales intake → `Enova_Sales_Intake_Gate_Shipped.md`
- Comms + QC/batch → `Enova_Comms_and_QC_Shipped.md`
- WIP stage integrity → `Enova_Stage_Integrity_Shipped.md`
- Formula engine / cost core → `Enova_Formulation_Generator_Engine.md`, `Enova_Brain_Kernel_Architecture.md`
- Schema / migration → `Enova_Relational_Schema_Phase1.md`, `Enova_Relational_Migration_and_Slice1.md`

Read the doc whose job matches the task. Add a second only for a genuinely distinct concern.

---

## Changelog
- **v2.0 (2026-08-10):** Build/verify/deploy (§3–§4) rewritten as tool-agnostic outcome gates; cloud
  offline-bundle Playwright and Supabase MCP blessed as first-class tooling; architecture evolution
  toward a real build (Vite / component split) explicitly permitted under checkpoint rules (§4.3); added
  rules-of-hooks and Babel-version-pinning invariants (§6); strengthened commit discipline (§7). Safety
  (§2), data/compliance architecture (§5), and business invariants (§6) unchanged.
- **v1.x:** Original single-file contract with fixed `verify.js` / `run_all_tests.sh` / `build_prod.js`
  commands and mandatory single-file + in-browser-Babel architecture.
