# Supabase migration history — Enova Brain (`rjvcynsojdgyckhgrlfd`)

The 57 named migrations below are the **authoritative, auditable DDL history** of the
database, in apply order. Each is visible in Supabase → Database → Migrations and is
individually reversible. This file is the manifest; to materialize the **exact verbatim
SQL** of every migration into this folder as `<version>_<name>.sql`, run:

```bash
supabase link --project-ref rjvcynsojdgyckhgrlfd
supabase db pull          # writes every migration's SQL into supabase/migrations/
```

> Why the manifest instead of pre-filled SQL: the verbatim SQL lives in the database
> (`supabase_migrations.schema_migrations`). `supabase db pull` reproduces it byte-for-byte
> with the CLI — the correct, lossless capture — so the repo tracks the DB as code without a
> hand-transcribed copy drifting from the source of truth. The one file captured verbatim
> here is the crown-jewel generator: [`../functions/erp_generate_formula.sql`](../functions/erp_generate_formula.sql).

| # | Version | Migration |
|--:|---------|-----------|
| 1 | 20260712013634 | add_studio_projects_store |
| 2 | 20260712181649 | add_studio_notifications |
| 3 | 20260713202146 | create_studio_inventory_shared_table |
| 4 | 20260713202153 | studio_inventory_realtime |
| 5 | 20260714171328 | tier1_roles_rls_lockdown |
| 6 | 20260714171341 | tier1_signup_domain_guard |
| 7 | 20260714171426 | tier1_lock_function_grants |
| 8 | 20260714172345 | tier2_immutable_audit |
| 9 | 20260714172654 | tier3_error_log |
| 10 | 20260714173351 | tier4_write_guard_and_rev |
| 11 | 20260714173713 | tier5_drop_dead_schema |
| 12 | 20260714174600 | tier5_tighten_error_log_insert |
| 13 | 20260717112843 | create_enova_digest_snapshots |
| 14 | 20260719162043 | erp_relational_schema |
| 15 | 20260719162209 | erp_refresh_and_views |
| 16 | 20260719170052 | erp_reporting_views |
| 17 | 20260719170148 | lock_down_erp_refresh_projections |
| 18 | 20260719172814 | erp_projection_enrichment_schema |
| 19 | 20260719172855 | erp_refresh_projections_enriched |
| 20 | 20260720165517 | erp_production_ops |
| 21 | 20260720173932 | enable_pg_trgm |
| 22 | 20260720174120 | production_order_match_provenance |
| 23 | 20260720174339 | erp_data_quality_flags |
| 24 | 20260721020048 | erp_generator_confidence_v1 |
| 25 | 20260721020127 | erp_refresh_confidence_fix_numeric |
| 26 | 20260721020234 | erp_refresh_all_wrapper |
| 27 | 20260721113122 | security_lockdown_rls_and_grants |
| 28 | 20260721113237 | revoke_anon_execute_refresh_rpcs |
| 29 | 20260721131639 | data_integrity_tier1_2_rematch_and_clean |
| 30 | 20260721161833 | mfso_signed_docs_storage_bucket |
| 31 | 20260722035100 | erp_fk_covering_indexes |
| 32 | 20260722035143 | harden_refresh_rpc_and_dq_policy |
| 33 | 20260722035156 | rls_initplan_optimization |
| 34 | 20260722035208 | snapshot_tables_admin_policies |
| 35 | 20260722035559 | erp_txn_referential_integrity |
| 36 | 20260722101639 | erp_transactional_inventory_api |
| 37 | 20260722103810 | harden_txn_views_and_rpc_grants |
| 38 | 20260722111225 | enable_pgcron_schedule_projection_refresh |
| 39 | 20260722235636 | erp_document_vault |
| 40 | 20260723004909 | erp_traceability_views |
| 41 | 20260723005709 | erp_command_center_views |
| 42 | 20260723011101 | erp_comms_qc_reporting_views |
| 43 | 20260723035329 | erp_stage_integrity_model |
| 44 | 20260723035511 | erp_stage_integrity_flag_sync |
| 45 | 20260723035558 | erp_stage_integrity_worklist_view |
| 46 | 20260723035636 | erp_normalize_stage_pin_search_path |
| 47 | 20260723041821 | erp_formula_blueprint_library |
| 48 | 20260723042346 | erp_blueprint_search_and_catalog |
| 49 | 20260723104640 | erp_formula_engine_tables |
| 50 | 20260723104715 | erp_generate_formula_engine |
| 51 | 20260723104757 | erp_generate_formula_engine_fix |
| 52 | 20260723113856 | erp_formula_engine_additive_rules |
| 53 | 20260723114026 | erp_generate_formula_all_forms |
| 54 | 20260724015552 | erp_generate_formula_full_column_set_and_m92 |
| 55 | 20260724022844 | erp_generate_formula_add_vendor_col_v |
| 56 | 20260725132117 | erp_add_tablet_form_and_compression_rate |
| 57 | 20260725132232 | erp_generate_formula_route_tablet |

**Generator engine migrations** (the "algorithms"): #47–#57 build the blueprint library,
the form-rule/config tables, and the `erp_generate_formula` RPC across all dosage forms
(capsule shell-fill, powder/stickpack/liquid target-fill, and the newest tablet route with
compression rate). The live function is captured in
[`../functions/erp_generate_formula.sql`](../functions/erp_generate_formula.sql).
