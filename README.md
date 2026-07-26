# Enova Brain — Master Repo

The single, consolidated home for **Enova Brain**, the ERP + formulation/quoting system for
Enova Science (GMP supplement contract manufacturer). This repo is the culmination of every
prior scattered build into one canonical tree.

```
┌────────────────────┐     git push      ┌───────────────┐   auto-deploy   ┌──────────────┐
│  This repo (GitHub) │ ────────────────▶ │    Vercel     │ ──────────────▶ │  index.html  │
│  source + build/CI  │                    │  static host  │                 │  (the app)   │
└─────────┬──────────┘                    └───────────────┘                 └──────┬───────┘
          │ DB as code (supabase/)                                                  │ RPC / realtime / auth
          ▼                                                                          ▼
                          ┌─────────────────────────────────────────┐
                          │  Supabase  ·  project rjvcynsojdgyckhgrlfd │
                          │  database + generator algorithms + RLS     │
                          └─────────────────────────────────────────┘
```

- **Supabase** holds the database, the write logic (transactional RPCs), and the **generator
  algorithms** (`erp_generate_formula` + the blueprint/form-rule tables). See [`supabase/README.md`](supabase/README.md).
- **GitHub** holds this repo (source of truth for the app + build/CI + docs + DB-as-code).
- **Vercel** hosts the app by serving the precompiled `index.html` from the repo on every push.

## What the app is
A single-file React 18 application, `Enova_Brain_Studio_2.html` (~12.6k lines). The deploy
file `index.html` is its **precompiled production build** (JSX compiled ahead of time,
babel-standalone removed). 19 pages: Dashboard, Command Center, Sales Intake, WIP Board,
Readiness, Projects, Formulation, Quote, Documents, Document Vault, Production, Review Queue,
Audit & Trace, Inventory, Stock Control, Sourcing, Formula Library, **Approvals** (new), and
Label Review (the one remaining "Soon" page).

## Repo layout
| Path | Role |
|------|------|
| `Enova_Brain_Studio_2.html` | **The source.** Edit this. |
| `index.html` | **The deploy file** — precompiled build of the source. Committed; Vercel serves it. |
| `build_prod.js` / `build_offline.js` | Build the precompiled deploy / the self-contained offline test bundle. |
| `ci_verify.js` | Portable CI gate — proves `index.html` is the fresh precompiled build. |
| `verify.js`, `run_all_tests.sh`, `test_*.js`, `shoot_*.js` | Verification harness (see gap note below). |
| `_sourcing_catalog.json`, `_sourcing_mined.json`, `_corpus_cases.json`, `enova_extract.json`, `enova_brain.js` | Build/reference data catalogs + the standalone kernel. |
| `supabase/` | **DB as code** — config, migration manifest, and the captured generator function. |
| `docs/` | Architecture: kernel, formulation engine, validation scorecard, master brief + handoff. |
| `vercel.json` / `.vercelignore` | Vercel serves **only** `index.html`; everything else is dev-only. |
| `AGENTS.md` / `RUNBOOK.md` / `WHATS_NEW.txt` | Operating contract · deploy/rollback runbook · changelog. |

## Deploy loop
1. Edit `Enova_Brain_Studio_2.html`.
2. `npm test` — run the local regression suite (`run_all_tests.sh`).
3. `npm run build` — `node build_prod.js && cp index.prod.html index.html` (precompile).
4. `npm run verify` — `ci_verify.js` must print **CI VERIFY PASSED**.
5. Commit the **source + `index.html`** and push. GitHub Actions re-runs the gate; Vercel auto-deploys.

Rollback = `git revert` the bad commit (Vercel redeploys the previous `index.html` within a minute).
Full details in [`RUNBOOK.md`](RUNBOOK.md).

## Database changes
Applied as **named migrations** via the Supabase CLI/MCP — never hand-edited on prod. Pull the
full verbatim history into `supabase/migrations/` with `supabase link --project-ref
rjvcynsojdgyckhgrlfd && supabase db pull`. Protocol and schema in [`supabase/README.md`](supabase/README.md).

## First-time setup
```bash
npm install                 # installs Babel + test deps (package.json)
npm run build && npm run verify
```

## Test suite status (verified 2026-07-25 on Windows)

`bash run_all_tests.sh` → **38 of 41 present checks PASS · 9 skipped · 3 fail.**
The **deploy gate (`npm run verify` / `ci_verify.js`) is fully green** — that is what CI and
Vercel depend on.

**Portability work done in this consolidation:** the harness was written for the original Linux
cloud sandbox and hardcoded `/root/...` and `/home/claude/.npm-global/...` everywhere, so *every*
test failed on Windows. All 48 harness scripts now resolve paths relative to the repo
(`__dirname`) with env-var overrides (`ENOVA_SRC`, `ENOVA_NG`, `ENOVA_KERNEL`, `ENOVA_OFFLINE`,
`ENOVA_PROD`, `ENOVA_SHOTS`, `ENOVA_REFS`, `ENOVA_BACKUPS`), `build_offline.js` is portable, and
`_kernel_for_tests.js` (a CommonJS shim over `enova_brain.js`, lost with the old workspace) was
reconstructed. Playwright Chromium is required for the browser drives: `npx playwright install chromium`.

### 9 skipped — test file absent on disk
`ssr_test.js`, `test_golden_thread.js`, `test_dashboard.js`, `test_comms_qc.js`, `test_intake.js`,
`test_library.js`, `test_password.js`, `test_slice1_ppgrid.js`, `test_slice1_unmatched_cost.js`.
These only ever existed in the reclaimed cloud workspace / the live GitHub repo. The runner now
**skips and reports** them instead of hard-failing. Merge them from the existing GitHub repo to
restore the full ~45-check suite.

### 3 failing — stale UI assertions, not app regressions
`shoot_fronts` · `shoot_readiness` · `shoot_commit`. These screenshot-drive tests date from the
2026-07-19 tree and assert against UI that has since changed (fronts reads 0 columns; readiness
waits on a `Pending Information` column head that no longer exists; commit expects the board to
default to Active scope). They need re-baselining against the current UI — **the app itself is
healthy**: the other browser drives (`command palette`, `wip manager matrix`, `moq + margin`,
`browser render gate`) pass with `page errors: NONE`.
- **Phase 2 — server generator:** the app's Formulation page still runs the generator in
  client-side JS. Supabase already has the authoritative `erp_generate_formula` RPC; wiring the
  app to call it (single source of truth) is the tracked follow-up and needs golden-thread/COGS
  re-validation before deploy.
- **Supabase dashboard toggle:** enable **Leaked Password Protection** (Auth → Policies) — only
  a human can do this; it is not a migration.

## Provenance
Consolidated 2026-07-25 from: the newest app tree (`enova-erp-buildout`, incl. the new Approvals
page), the full test/doc set from `EnovaBrain_build_20260717`, the root master briefs, and the
live Supabase project captured as code. Heavy reference data (MISys workbooks, Salesforce export,
the ~250-file corpus, `.pst`) is intentionally kept **out** of the repo (git-ignored) to keep
deploys fast; it remains archived under `Z:\Enova`.
