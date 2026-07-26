# Supabase — the Enova Brain backend (system of record)

Project: **`enova-brain`** · ref **`rjvcynsojdgyckhgrlfd`** · region `us-east-2` · Postgres 17.
Supabase holds **the database, the generator algorithms, and the write logic**; the app
(single-file React in the repo root) is the client; GitHub → Vercel hosts the client.

## Layout of this folder
- `config.toml` — project ref for the Supabase CLI.
- `migrations/MANIFEST.md` — the ordered 57-migration history; run `supabase db pull` to fill this folder with the verbatim SQL.
- `functions/erp_generate_formula.sql` — the server-side formula generator (captured verbatim; the DB is authoritative).

## Two-layer, CQRS-lite architecture
1. **Document truth** — `studio_projects` (557 rows): one JSONB blob per project, the single
   source of truth for commercial data. The app loads it once + a realtime subscription and
   writes via optimistic-locked upserts (`rev`).
2. **Projected read-model** — `erp_refresh_all()` / `erp_refresh_projections()` / `erp_refresh_confidence()`
   project the JSONB into relational `erp_*` tables and `erp_v_*` reporting views (eventual
   consistency; a `pg_cron` job refreshes them). Dashboard, Command Center, Review Queue,
   Traceability, and Comms/QC read these views. Refresh functions never touch the transactional tables.
3. **Transactional system of record** — inventory/purchasing/MO move **only** through six
   SECURITY DEFINER RPCs (the only write path; the tables carry no write-RLS):
   `erp_inv_adjust`, `erp_po_create`, `erp_po_receive`, `erp_mo_create`, `erp_mo_issue`, `erp_mo_shortage_po`.
   Each requires an authenticated **admin**, writes an immutable ledger row, and is atomic
   (FEFO issue, over-receipt/negative-underflow blocked).

## The generator (the "algorithms")
`public.erp_generate_formula(p_actives jsonb, p_form, p_serving_size, p_target_serving_mg,
p_target_serving_ml, p_servings_per_unit, p_po_qty, p_packaging)` → JSONB. Deterministic (no AI):
dosing (mg/potency×(1+overage)), per-form system additives + fill/solvent balance, and a live
MISys-costed roll-up. Backed by `erp_form_config`, `erp_form_system_rules`, `erp_capsule_shells`,
`erp_formula_blueprints` (150) + `erp_blueprint_ingredients` (1,072), `erp_inventory_items` (1,733).
See `functions/erp_generate_formula.sql`.

> **Consolidation note (Phase 2):** the deployed app's Formulation page still runs the
> equivalent generator in **client-side JS**. Wiring the app to call this RPC as the single
> source of truth is the tracked follow-up — it is a behavior-affecting change that must be
> re-validated (golden-thread / COGS parity) before deploy.

## Tables (39 · `public`)
Document/core: `studio_projects`, `studio_roles` (7 admins), `studio_audit` (hash-chained,
append-only), `studio_errors`, `studio_notifications`, `studio_inventory`, `employees`,
`enova_digest_snapshots`. ERP relational: `erp_customers` (270), `erp_projects` (557),
`erp_project_ingredients` (690), `erp_project_tiers`, `erp_project_costs`, `erp_project_stage_history`,
`erp_project_documents`, `erp_project_confidence`. Transactional: `erp_inventory_items` (1,733),
`erp_inventory_lots`, `erp_inventory_transactions`, `erp_bom_lines`, `erp_manufacturing_orders`,
`erp_mo_consumption`, `erp_purchase_orders`, `erp_po_lines`. Production ops: `erp_production_orders`
(98), `erp_order_gates` (524), `erp_gate_catalog` (23), `erp_shipments` (30), `erp_data_quality_flags` (371).
Generator: `erp_formula_blueprints` (150), `erp_blueprint_ingredients` (1,072), `erp_capsule_shells` (8),
`erp_form_system_rules` (31), `erp_form_config` (5), `erp_config` (5). (Plus dated `*_bak_/_snap_` backup tables.)

## Security model
- **RLS everywhere.** Admin-write / viewer-read via `studio_roles` + `is_studio_admin()`.
  Admins: carlos, tong, marina, nick, jonathan, ryan, jbradfield @enovascience.com.
- A DB trigger rejects non-`@enovascience.com` signups (defense in depth).
- **Part-11:** `studio_audit` (append-only, hash-chained) + the inventory ledger are the
  tamper-evident record.
- The 6 transactional RPCs + the document-vault RPCs (`erp_doc_register/approve/setstatus`)
  intentionally show as `authenticated SECURITY DEFINER` in the security advisor — that is the
  authorized, admin-enforced, actor-logged write API and is expected.

## Storage / Functions
- Storage bucket for **MFSO signed documents** (migration `mfso_signed_docs_storage_bucket`).
- Edge function **`intake-extract`** (parses a customer intake into structured fields).
  Download its source with `supabase functions download intake-extract`.

## ⚠ One item only a human can do (Supabase dashboard)
**Enable Leaked Password Protection** — Auth → Policies (checks HaveIBeenPwned). It is a
dashboard toggle, not a migration, and is currently **disabled**. Also recommended: enable
Point-in-Time Recovery and run a test restore.

## DB change protocol
`list_tables` first → `apply_migration` (named; never hand-edit prod DDL casually) →
`get_advisors` (security + performance) after every DDL. Never widen a write policy back to
`USING (true)` and never drop the `is_studio_admin()` check.
