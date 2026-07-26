-- ─────────────────────────────────────────────────────────────────────────────
-- Enova Brain — SERVER-SIDE FORMULA GENERATOR (authoritative algorithm)
--
-- This is a captured snapshot of the live Postgres function on the Supabase
-- project `rjvcynsojdgyckhgrlfd` (enova-brain). The DATABASE is authoritative;
-- this file is the human-readable, version-controlled copy so the generator
-- algorithm lives in the repo alongside the app. Regenerate the exact current
-- definition any time with:
--
--   supabase link --project-ref rjvcynsojdgyckhgrlfd
--   supabase db pull            # writes the full migration history to migrations/
--   -- or, for just this function:
--   -- select pg_get_functiondef('public.erp_generate_formula(jsonb,text,integer,numeric,numeric,integer,integer,jsonb)'::regprocedure);
--
-- WHAT IT DOES (deterministic, NO AI — every number traces to a rule/table):
--   • Dosing: for each customer active, input_mg = mg / potency * (1 + overage).
--   • Capsules  → "shell-fill": adds the Enova flow system (Mag Stearate + Silica
--                 at 0.75% of actives each), picks the smallest capsule shell that
--                 fits (erp_capsule_shells), and bulks with MCC to the shell minimum.
--   • Powder/Stickpack/Liquid/Tablet → "target-fill": applies the per-form system
--                 additives (erp_form_system_rules) at corpus-median or %-of-target
--                 levels, then balances to the target serving weight/volume with the
--                 form's fill/solvent (erp_form_config).
--   • Costing: joins each line to erp_inventory_items (live MISys cost) to compute
--                 cost/serving, cost/unit, blend %, kg/batch, and the M92 direct-
--                 materials-per-unit roll-up; flags unpriced lines.
--   • Returns a single JSONB: { rows[], warnings[], notes[], blend{}, packaging_rows[],
--                 direct_materials_per_unit, batch{}, unpriced_lines[], ... }.
--
-- Backing tables/config: erp_form_config, erp_form_system_rules, erp_capsule_shells,
-- erp_inventory_items, erp_formula_blueprints/erp_blueprint_ingredients (library).
--
-- NOTE (architecture): as of this consolidation the deployed app's Formulation page
-- still runs the equivalent generator in client-side JS; wiring the app to call this
-- RPC as the single source of truth is the tracked Phase-2 follow-up.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.erp_generate_formula(
    p_actives jsonb,
    p_form text DEFAULT 'Capsules'::text,
    p_serving_size integer DEFAULT 1,
    p_target_serving_mg numeric DEFAULT NULL::numeric,
    p_target_serving_ml numeric DEFAULT NULL::numeric,
    p_servings_per_unit integer DEFAULT NULL::integer,
    p_po_qty integer DEFAULT NULL::integer,
    p_packaging jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_form text; v_cfg record; r record; v_i numeric;
  v_actives_mg numeric := 0;
  v_rows jsonb := '[]'::jsonb; v_warn jsonb := '[]'::jsonb; v_notes jsonb := '[]'::jsonb;
  v_ss int := greatest(1, coalesce(p_serving_size,1));
  v_spu int := nullif(greatest(coalesce(p_servings_per_unit,0),0),0);
  v_qty int := nullif(greatest(coalesce(p_po_qty,0),0),0);
  v_flow numeric := 0; v_blend numeric; v_per_cap numeric; v_shell text; v_shell_min numeric; v_mcc numeric; v_max000 numeric; v_mg numeric;
  v_target numeric := 0; v_target_src text := ''; v_has_target boolean; v_sys numeric := 0; v_fill numeric;
  v_active_alts text[]; v_fill_name text; v_fill_sku text; v_fill_role text;
  v_meta jsonb := '{}'::jsonb;
  v_rows2 jsonb; v_i69 numeric; v_k69 numeric; v_o69 numeric; v_p69 numeric; v_n69 numeric;
  v_pkg_rows jsonb; v_pkg_cost numeric; v_m92 numeric; v_unpriced jsonb;
begin
  v_form := case
    when lower(coalesce(p_form,'')) ~ 'capsule' then 'Capsules'
    when lower(coalesce(p_form,'')) ~ 'tablet|caplet' then 'Tablet'
    when lower(coalesce(p_form,'')) ~ 'stick' then 'Stickpacks'
    when lower(coalesce(p_form,'')) ~ 'powder' then 'Powder'
    when lower(coalesce(p_form,'')) ~ 'liquid|tincture|shot|syrup|sachet' then 'Liquid'
    else null end;
  if v_form is null then
    return jsonb_build_object('form',p_form,'error','No deterministic system for this form yet (gummies use the app gummy base).');
  end if;
  select * into v_cfg from erp_form_config where form=v_form;

  for r in select (a->>'name') as name, nullif(a->>'alt','') as sku,
                  coalesce((a->>'mg')::numeric,0) as g,
                  coalesce((a->>'pot')::numeric,(a->>'potency')::numeric,1) as pot,
                  coalesce((a->>'ov')::numeric,(a->>'overage')::numeric,0) as ov
           from jsonb_array_elements(coalesce(p_actives,'[]'::jsonb)) a
           where coalesce((a->>'mg')::numeric,0)>0 loop
    v_i := round( (r.g / (case when coalesce(r.pot,0)=0 then 1 else r.pot end)) * (1 + coalesce(r.ov,0)), 4);
    v_actives_mg := v_actives_mg + v_i;
    v_rows := v_rows || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'name',r.name,'sku',r.sku,'mg',round(r.g,3),'input_mg_serving',v_i,
      'potency_pct', case when r.pot=1 then null else r.pot end,
      'overage_pct', case when r.ov=0 then null else r.ov end,
      'role','Active','source','request','confirm',false)));
  end loop;
  if v_actives_mg <= 0 then return jsonb_build_object('form',v_form,'error','No dosed actives provided.'); end if;

  if v_cfg.balance_model = 'shell-fill' then
    for r in select name,sku,rule_value,note,confirm from erp_form_system_rules where form='Capsules' and rule_type='pct_actives' order by seq loop
      v_mg := round(v_actives_mg * r.rule_value,2);
      if v_mg>0 then v_flow := v_flow+v_mg;
        v_rows := v_rows || jsonb_build_array(jsonb_build_object('name',r.name,'sku',r.sku,'mg',v_mg,'input_mg_serving',v_mg,'role',r.note,'source','enova-standard','confirm',coalesce(r.confirm,true)));
      end if;
    end loop;
    v_blend := v_actives_mg + v_flow; v_per_cap := v_blend/v_ss;
    select max_fill into v_max000 from erp_capsule_shells order by sort_order desc limit 1;
    select size,min_fill into v_shell,v_shell_min from erp_capsule_shells where max_fill >= v_per_cap order by sort_order limit 1;
    if v_shell is null then select size,min_fill into v_shell,v_shell_min from erp_capsule_shells order by sort_order desc limit 1; end if;
    if v_per_cap > v_max000 then v_warn := v_warn || to_jsonb(('One capsule''s blend ('||round(v_per_cap)||' mg) exceeds a size 000 capsule ('||round(v_max000)||' mg). Increase capsules/serving (currently '||v_ss||').')::text); end if;
    v_mcc := greatest(0, round(v_shell_min*v_ss - v_blend,2));
    if v_mcc>0 then
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('name','Microcrystalline Cellulose','sku','ALT-RP-0493','mg',v_mcc,'input_mg_serving',v_mcc,'role','Fill / bulking','source','computed-balance','confirm',false,'note','fills to size '||v_shell||' minimum'));
    end if;
    v_notes := v_notes || to_jsonb(('Shell size '||v_shell||' · fill ~ '||round((v_blend+v_mcc)/v_ss)||' mg/capsule · '||v_ss||' capsule(s)/serving.')::text);
    v_notes := v_notes || to_jsonb('Flow system (Mag Stearate + Silica) is Enova capsule standard at 0.75% of actives each - editable.'::text);
    if v_mcc=0 then v_notes := v_notes || to_jsonb('Actives fill the shell - no bulking needed.'::text); end if;
    v_meta := jsonb_build_object('form','Capsules','engine','deterministic (no AI)','shell',v_shell,'caps_per_serving',v_ss,
      'actives_mg',round(v_actives_mg,2),'blend_mg',round(v_blend+v_mcc,2),'fill_per_capsule',round((v_blend+v_mcc)/v_ss,2));
  else
    if v_cfg.balance_model='volume-fill' then
      if coalesce(p_target_serving_ml,0)>0 then v_target := p_target_serving_ml * coalesce(v_cfg.density,1) * 1000; v_target_src := p_target_serving_ml||' mL x '||coalesce(v_cfg.density,1)||' g/mL'; end if;
    else
      if coalesce(p_target_serving_mg,0)>0 then v_target := p_target_serving_mg; v_target_src := round(v_target)||' mg'; end if;
    end if;
    v_has_target := v_target > 0;
    select coalesce(array_agg(a->>'alt') filter (where nullif(a->>'alt','') is not null), '{}')
      into v_active_alts from jsonb_array_elements(coalesce(p_actives,'[]'::jsonb)) a where coalesce((a->>'mg')::numeric,0)>0;
    select name, sku, role into v_fill_name, v_fill_sku, v_fill_role from erp_form_system_rules where form=v_form and rule_type='balance' limit 1;

    for r in select name,sku,rule_value,med_mg,scale,skip_if_active,confirm,role,note from erp_form_system_rules where form=v_form and rule_type='system_additive' order by seq loop
      if r.skip_if_active and r.sku is not null and r.sku = any(v_active_alts) then
        v_notes := v_notes || to_jsonb((r.name||' skipped - already dosed as a customer active.')::text); continue;
      end if;
      v_mg := case when r.scale and v_has_target then round(v_target*r.rule_value,2) else round(r.med_mg,2) end;
      if v_mg <= 0 then continue; end if;
      v_sys := v_sys + v_mg;
      v_rows := v_rows || jsonb_build_array(jsonb_build_object('name',r.name,'sku',r.sku,'mg',v_mg,'input_mg_serving',v_mg,'role',r.role,'source','enova-standard','confirm',coalesce(r.confirm,true),
        'note',(case when r.scale and v_has_target then round(r.rule_value*100,3)||'% of '||v_cfg.target_label else 'corpus-median dose' end)||coalesce(' · '||r.note,'')));
    end loop;

    if v_has_target then
      v_fill := round(v_target - v_actives_mg - v_sys, 2);
      if v_fill > 0 then
        v_rows := v_rows || jsonb_build_array(jsonb_build_object('name',v_fill_name,'sku',v_fill_sku,'mg',v_fill,'input_mg_serving',v_fill,'role',v_fill_role,'source','computed-balance','confirm',false,'note','balance to '||v_cfg.target_label||' ('||v_target_src||')'));
      elsif v_fill < 0 then
        v_warn := v_warn || to_jsonb(('Actives + system ('||round(v_actives_mg+v_sys)||' mg) exceed the target '||v_cfg.target_label||' ('||round(v_target)||' mg) by '||round(-v_fill)||' mg - raise the '||v_cfg.target_label||' or trim the system.')::text);
      else
        v_notes := v_notes || to_jsonb('Actives + system exactly meet the target - no bulking/solvent needed.'::text);
      end if;
      v_notes := v_notes || to_jsonb(('Built to a '||v_target_src||' '||v_cfg.target_label||'; '||v_fill_name||' is the balance. Every taste level is a corpus-median default - confirm before approving.')::text);
    else
      v_warn := v_warn || to_jsonb(('No '||v_cfg.target_label||' set - added the Enova system at corpus-median levels but could NOT compute the '||v_fill_name||' balance. Set the '||v_cfg.target_label||' and rebuild for a complete formula.')::text);
    end if;

    v_meta := jsonb_build_object('form',v_form,'engine','deterministic (no AI)','unit',v_cfg.unit,
      'target_mg', case when v_has_target then round(v_target,2) else null end,'actives_mg',round(v_actives_mg,2));
  end if;

  select jsonb_agg(row_out order by ord), max(i69), max(k69), max(o69), max(p69), max(n69)
    into v_rows2, v_i69, v_k69, v_o69, v_p69, v_n69
  from (
    with base as (
      select ord, e, nullif(e->>'sku','') as sku,
             coalesce((e->>'input_mg_serving')::numeric,(e->>'mg')::numeric,0) as i
      from jsonb_array_elements(v_rows) with ordinality as t(e,ord)
    ),
    px as (
      select b.*, ii.unit_cost, ii.supplier as vendor,
        round(coalesce(ii.unit_cost,0)*1000,5) as price_per_kg,
        round(b.i/1000.0,6) as g_serving,
        round((b.i/1000.0)*coalesce(ii.unit_cost,0),5) as cps,
        case when v_spu is not null then round(b.i*v_spu/1000.0,6) end as g_unit,
        case when v_spu is not null then b.i*v_spu/1000000.0 end as kg_unit_raw,
        case when v_spu is not null then round((b.i/1000.0)*coalesce(ii.unit_cost,0)*v_spu,6) end as cost_unit
      from base b left join erp_inventory_items ii on ii.sku=b.sku
    ),
    w as (
      select px.*,
        sum(kg_unit_raw) over () as o69_raw,
        sum(cps) over () as k69,
        sum(i) over () as i69,
        sum(case when v_spu is not null then i*v_spu/1000.0 end) over () as n69,
        sum(cost_unit) over () as p69
      from px
    )
    select ord,
      e || jsonb_strip_nulls(jsonb_build_object(
        'cost_per_serving', cps,
        'vendor', vendor,
        'price_per_kg', case when price_per_kg>0 then price_per_kg else null end,
        'g_serving', g_serving,
        'g_unit', g_unit,
        'kg_unit', case when kg_unit_raw is not null then round(kg_unit_raw,9) end,
        'cost_unit', cost_unit,
        'pct_blend', case when o69_raw>0 and kg_unit_raw is not null then round(kg_unit_raw/o69_raw,6) end,
        'g_per_kg', case when o69_raw>0 and kg_unit_raw is not null then round(kg_unit_raw/o69_raw*1000,4) end,
        'cost_per_kg_blend', case when o69_raw>0 and kg_unit_raw is not null then round((kg_unit_raw/o69_raw)*price_per_kg,5) end,
        'kg_batch', case when v_qty is not null and kg_unit_raw is not null then round(kg_unit_raw*v_qty,6) end,
        'cost_batch', case when v_qty is not null and cost_unit is not null then round(cost_unit*v_qty,4) end,
        'unpriced', case when price_per_kg=0 and i>0 then true else null end
      )) as row_out,
      i69, k69, o69_raw as o69, p69, n69
    from w
  ) s;

  if p_packaging is not null and jsonb_typeof(p_packaging)='array' and jsonb_array_length(p_packaging)>0 then
    select jsonb_agg(pk order by ord), coalesce(sum(cu),0) into v_pkg_rows, v_pkg_cost
    from (
      select ord,
        jsonb_strip_nulls(jsonb_build_object(
          'role', e->>'role','sku', nullif(e->>'sku',''),'desc', e->>'desc',
          'price_each', pe,'qty_per_unit', q,'cost_unit', round(pe*q,5))) as pk,
        round(pe*q,5) as cu
      from (
        select e, ord,
          coalesce((e->>'price')::numeric,(e->>'price_each')::numeric,
                   (select unit_cost from erp_inventory_items where sku=nullif(e->>'sku','')),0) as pe,
          coalesce((e->>'qty')::numeric,(e->>'qty_per_unit')::numeric,1) as q
        from jsonb_array_elements(p_packaging) with ordinality as t(e,ord)
      ) a
    ) b;
  end if;

  v_m92 := case when v_spu is not null then round(coalesce(v_p69,0)+coalesce(v_pkg_cost,0),5) else null end;

  select jsonb_agg(distinct coalesce(e->>'name', e->>'sku'))
    into v_unpriced from jsonb_array_elements(v_rows2) e where (e->>'unpriced')='true';

  return v_meta || jsonb_strip_nulls(jsonb_build_object(
    'rows', v_rows2,
    'warnings', v_warn,
    'notes', v_notes,
    'materials_cost_per_serving', round(v_k69,5),
    'blend', jsonb_build_object(
       'total_input_mg_serving', round(v_i69,3),
       'serving_weight_g', round(v_i69/1000.0,4),
       'g_per_unit', case when v_spu is not null then round(v_n69,4) else null end,
       'kg_per_unit', case when v_spu is not null then round(v_o69,6) else null end,
       'blend_cost_per_serving', round(v_k69,5),
       'blend_cost_per_unit', case when v_spu is not null then round(v_p69,5) else null end),
    'packaging_rows', v_pkg_rows,
    'packaging_cost_per_unit', case when v_pkg_cost is not null then round(v_pkg_cost,5) else null end,
    'direct_materials_per_unit', v_m92,
    'servings_per_unit', v_spu,
    'po_qty', v_qty,
    'batch', case when v_qty is not null then jsonb_build_object(
        'units', v_qty,
        'blend_kg', case when v_spu is not null then round(v_o69*v_qty,4) else null end,
        'materials_cost', case when v_spu is not null then round(v_p69*v_qty,2) else null end) else null end,
    'unpriced_lines', v_unpriced,
    'rollup_note', case
       when v_spu is null then 'Per-unit roll-up (N,O,P,M92) pending: pass p_servings_per_unit to compute direct materials per unit.'
       when v_pkg_cost is null then 'Direct materials = blend only; packaging pending (pass p_packaging for full M92).'
       else null end
  ));
end $function$;
