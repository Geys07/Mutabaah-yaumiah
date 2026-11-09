-- One-time global start date for Mutabaah calculations.
create or replace function public.mutabaah_calculation_start_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(s.value->>'started_on', '')::date
  from public.app_settings s
  where s.key = 'mutabaah_calculation_start'
$$;

revoke all on function public.mutabaah_calculation_start_date() from public, anon;
grant execute on function public.mutabaah_calculation_start_date() to authenticated;

create or replace function public.start_mutabaah_calculation()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value jsonb;
begin
  if auth.uid() is null
     or not public.has_role('admin')
     or not exists (
       select 1 from public.profiles p
       where p.user_id = auth.uid() and p.account_status = 'active'
     ) then
    raise exception 'Hanya Admin aktif yang dapat memulai perhitungan';
  end if;

  insert into public.app_settings(key, value, updated_at)
  values (
    'mutabaah_calculation_start',
    jsonb_build_object(
      'started_on', (now() at time zone 'Asia/Jakarta')::date,
      'started_at', now(),
      'started_by', auth.uid()
    ),
    now()
  )
  on conflict (key) do nothing;

  select s.value into v_value
  from public.app_settings s
  where s.key = 'mutabaah_calculation_start';

  return v_value;
end;
$$;

revoke all on function public.start_mutabaah_calculation() from public, anon;
grant execute on function public.start_mutabaah_calculation() to authenticated;

-- Temporary helper: patch existing function definitions without replacing
-- unrelated authorization and business logic.
create or replace function public._mutabaah_patch_calc_function(
  p_function regprocedure,
  p_old text,
  p_new text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(p_function);
  if position(p_old in v_definition) = 0 then
    raise exception 'Expected source fragment not found in %', p_function;
  end if;
  v_definition := replace(v_definition, p_old, p_new);
  execute v_definition;
end;
$$;

-- Admin/teacher daily dashboard and class report.
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_class_day_status(uuid,date)'::regprocedure,
  't:=(now() at time zone ''Asia/Jakarta'')::date;',
  't:=(now() at time zone ''Asia/Jakarta'')::date; if public.mutabaah_calculation_start_date() is null or p_date < public.mutabaah_calculation_start_date() then return ''[]''::jsonb; end if;'
);

select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_class_month_status(uuid,date)'::regprocedure,
  'b:=least((a+interval ''1 month - 1 day'')::date,t);',
  'if public.mutabaah_calculation_start_date() is null then return ''[]''::jsonb; end if; a:=greatest(a,public.mutabaah_calculation_start_date()); if a>t then return ''[]''::jsonb; end if; b:=least((a+interval ''1 month - 1 day'')::date,t);'
);

select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_class_report(uuid,date)'::regprocedure,
  'v_today:=(now() at time zone ''Asia/Jakarta'')::date;',
  'v_today:=(now() at time zone ''Asia/Jakarta'')::date; if public.mutabaah_calculation_start_date() is null or p_date < public.mutabaah_calculation_start_date() then return ''[]''::jsonb; end if;'
);

-- Parent calendar: no pre-activation days are counted or displayed as filled.
select public._mutabaah_patch_calc_function(
  'public.get_parent_mutabaah_month_status(uuid,date)'::regprocedure,
  'b:=least((a+interval ''1 month - 1 day'')::date,t);',
  'if public.mutabaah_calculation_start_date() is null then return ''[]''::jsonb; end if; a:=greatest(a,public.mutabaah_calculation_start_date()); if a>t then return ''[]''::jsonb; end if; b:=least((a+interval ''1 month - 1 day'')::date,t);'
);

select public._mutabaah_patch_calc_function(
  'public.get_parent_mutabaah_month(uuid,date)'::regprocedure,
  'v_end:=(v_start+interval ''1 month'')::date;',
  'v_end:=(v_start+interval ''1 month'')::date; if public.mutabaah_calculation_start_date() is null then return ''[]''::jsonb; end if; v_start:=greatest(v_start,public.mutabaah_calculation_start_date()); if v_start>=v_end then return ''[]''::jsonb; end if;'
);

-- Monthly reports and required-activity reports.
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_monthly_report(uuid,date)'::regprocedure,
  'v_start:=date_trunc(''month'',p_month::timestamp)::date;',
  'v_start:=date_trunc(''month'',p_month::timestamp)::date; if public.mutabaah_calculation_start_date() is null then return ''[]''::jsonb; end if; v_start:=greatest(v_start,public.mutabaah_calculation_start_date());'
);

select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_monthly_required_report(uuid,date)'::regprocedure,
  'v_start:=date_trunc(''month'',p_month::timestamp)::date;',
  'v_start:=date_trunc(''month'',p_month::timestamp)::date; if public.mutabaah_calculation_start_date() is null then return ''[]''::jsonb; end if; v_start:=greatest(v_start,public.mutabaah_calculation_start_date());'
);

-- Semester report, detailed report-card data, and bonus report.
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_semester_report(uuid,uuid)'::regprocedure,
  'if v_start>v_today then raise exception ''Semester belum dimulai''; end if;',
  'if v_start>v_today then raise exception ''Semester belum dimulai''; end if; if public.mutabaah_calculation_start_date() is null then return ''[]''::jsonb; end if; v_start:=greatest(v_start,public.mutabaah_calculation_start_date()); if v_start>v_end then return ''[]''::jsonb; end if;'
);

select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_report_details(uuid,uuid)'::regprocedure,
  'if not found then raise exception ''Semester tidak sesuai kelas'';end if;',
  'if not found then raise exception ''Semester tidak sesuai kelas'';end if; if public.mutabaah_calculation_start_date() is null then return ''[]''::jsonb; end if; v_start:=greatest(v_start,public.mutabaah_calculation_start_date()); if v_start>v_end then return ''[]''::jsonb; end if;'
);

select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_report_bonus(uuid,uuid)'::regprocedure,
  'IF NOT FOUND THEN RAISE EXCEPTION ''Semester tidak sesuai kelas'';END IF;',
  'IF NOT FOUND THEN RAISE EXCEPTION ''Semester tidak sesuai kelas'';END IF; IF public.mutabaah_calculation_start_date() IS NULL THEN RETURN ''[]''::jsonb; END IF; v_start:=greatest(v_start,public.mutabaah_calculation_start_date()); IF v_start>v_end THEN RETURN ''[]''::jsonb; END IF;'
);

-- Bonus counts for monthly/periodic report exports.
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_bonus_counts(uuid,date,date)'::regprocedure,
  'DECLARE v_today date:=(now() AT TIME ZONE ''Asia/Jakarta'')::date;v_result jsonb;',
  'DECLARE v_today date:=(now() AT TIME ZONE ''Asia/Jakarta'')::date;v_result jsonb;v_calc_start date;'
);
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_bonus_counts(uuid,date,date)'::regprocedure,
  ' THEN RAISE EXCEPTION ''Kelas atau rentang tanggal tidak valid'';END IF;',
  ' THEN RAISE EXCEPTION ''Kelas atau rentang tanggal tidak valid'';END IF; v_calc_start:=public.mutabaah_calculation_start_date(); IF v_calc_start IS NULL THEN RETURN ''[]''::jsonb; END IF;'
);
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_bonus_counts(uuid,date,date)'::regprocedure,
  'BETWEEN p_start_date AND p_end_date',
  'BETWEEN greatest(p_start_date,v_calc_start) AND p_end_date'
);
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_bonus_counts(uuid,date,date)'::regprocedure,
  'e.starts_on<=p_end_date AND (e.ends_on IS NULL OR e.ends_on>=p_start_date)',
  'e.starts_on<=p_end_date AND (e.ends_on IS NULL OR e.ends_on>=greatest(p_start_date,v_calc_start))'
);

-- Change-history pages are also calculation-period data.
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_change_history(uuid,date,date)'::regprocedure,
  'where h.entry_date between p_start_date and p_end_date',
  'where public.mutabaah_calculation_start_date() is not null and h.entry_date >= public.mutabaah_calculation_start_date() and h.entry_date between p_start_date and p_end_date'
);
select public._mutabaah_patch_calc_function(
  'public.get_mutabaah_change_history(uuid,date,date,integer,integer)'::regprocedure,
  'WHERE h.entry_date BETWEEN p_start_date AND p_end_date',
  'WHERE public.mutabaah_calculation_start_date() IS NOT NULL AND h.entry_date >= public.mutabaah_calculation_start_date() AND h.entry_date BETWEEN p_start_date AND p_end_date'
);

drop function public._mutabaah_patch_calc_function(regprocedure,text,text);
