-- Prevent parent draft/finalization writes before the calculation period starts.
-- Historical records are retained; only new parent submissions are blocked.
DO $migration$
DECLARE
  v_definition text;
  v_old text;
  v_guard text := E'\n if public.mutabaah_calculation_start_date() is null or p_date < public.mutabaah_calculation_start_date() then\n  raise exception ''Pengisian Mutabaah belum dapat dilakukan karena periode perhitungan belum dimulai'';\n end if;';
BEGIN
  -- The lower-level helper is also exposed to authenticated RPC callers;
  -- keep parents from bypassing the parent-specific wrapper.
  v_old := $old$if not (public.has_role('admin') or exists(select 1 from public.student_guardians sg join public.profiles p on p.user_id=sg.guardian_id where sg.student_id=p_student_id and sg.guardian_id=v_uid and p.account_status='active')) then raise exception 'Akses ditolak'; end if;$old$;
  SELECT pg_get_functiondef('public.save_mutabaah_day(uuid,date,jsonb)'::regprocedure)
  INTO v_definition;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Guard anchor save_mutabaah_day tidak ditemukan; migration dibatalkan.';
  END IF;
  v_definition := replace(
    v_definition,
    v_old,
    v_old || E'\n if not public.has_role(''admin'') and (public.mutabaah_calculation_start_date() is null or p_date < public.mutabaah_calculation_start_date()) then\n  raise exception ''Pengisian Mutabaah belum dapat dilakukan karena periode perhitungan belum dimulai'';\n end if;'
  );
  EXECUTE v_definition;

  v_old := $old$if auth.uid() is null or not exists(select 1 from public.student_guardians sg join public.profiles p on p.user_id=sg.guardian_id where sg.student_id=p_student_id and sg.guardian_id=auth.uid() and p.account_status='active') then raise exception 'Akses orang tua ditolak'; end if;$old$;
  SELECT pg_get_functiondef('public.save_parent_mutabaah_day(uuid,date,boolean,jsonb)'::regprocedure)
  INTO v_definition;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Guard anchor save_parent_mutabaah_day tidak ditemukan; migration dibatalkan.';
  END IF;
  v_definition := replace(v_definition, v_old, v_old || v_guard);
  EXECUTE v_definition;

  v_old := $old$if v_uid is null or not exists(select 1 from public.student_guardians g join public.profiles p on p.user_id=g.guardian_id and p.account_status='active' where g.student_id=p_student_id and g.guardian_id=v_uid) then raise exception 'Akses orang tua ditolak'; end if;$old$;
  SELECT pg_get_functiondef('public.submit_parent_mutabaah_day(uuid,date,boolean,jsonb,boolean)'::regprocedure)
  INTO v_definition;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Guard anchor submit_parent_mutabaah_day tidak ditemukan; migration dibatalkan.';
  END IF;
  v_definition := replace(v_definition, v_old, v_old || v_guard);
  EXECUTE v_definition;
END;
$migration$;
