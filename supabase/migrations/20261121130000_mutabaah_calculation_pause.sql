-- Allow admins to pause/resume parent Mutabaah entry without changing
-- the original calculation start date or affecting historical reports.

CREATE OR REPLACE FUNCTION public.parent_mutabaah_calculation_is_open(
  p_student_id uuid,
  p_date date
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_start date;
  v_paused boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.student_guardians sg
    JOIN public.profiles p ON p.user_id = sg.guardian_id
    WHERE sg.student_id = p_student_id
      AND sg.guardian_id = auth.uid()
      AND p.account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Akses orang tua ditolak';
  END IF;

  SELECT COALESCE((s.value ->> 'paused')::boolean, false)
    INTO v_paused
  FROM public.app_settings s
  WHERE s.key = 'mutabaah_calculation_pause';

  v_start := public.mutabaah_calculation_start_date();
  RETURN NOT COALESCE(v_paused, false)
    AND v_start IS NOT NULL
    AND p_date IS NOT NULL
    AND p_date >= v_start;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_mutabaah_calculation_paused(p_paused boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_value jsonb;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role('admin')
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND p.account_status = 'active'
     ) THEN
    RAISE EXCEPTION 'Hanya Admin aktif yang dapat mengubah status perhitungan';
  END IF;

  IF public.mutabaah_calculation_start_date() IS NULL THEN
    RAISE EXCEPTION 'Perhitungan belum dimulai';
  END IF;

  INSERT INTO public.app_settings(key, value, updated_at)
  VALUES (
    'mutabaah_calculation_pause',
    jsonb_build_object(
      'paused', p_paused,
      'updated_at', now(),
      'updated_by', auth.uid()
    ),
    now()
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now();

  SELECT s.value INTO v_value
  FROM public.app_settings s
  WHERE s.key = 'mutabaah_calculation_pause';

  RETURN v_value;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_mutabaah_calculation_paused(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_mutabaah_calculation_paused(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_mutabaah_calculation_paused(boolean) TO authenticated;

-- Defense in depth: block writes from linked parent accounts while paused,
-- even if a parent calls a write RPC directly instead of using the UI.
CREATE OR REPLACE FUNCTION public.guard_parent_mutabaah_writes_during_pause()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_student_id uuid;
  v_paused boolean;
BEGIN
  IF auth.uid() IS NULL OR public.has_role('admin') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
  ELSE
    v_student_id := NEW.student_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.student_guardians sg
    JOIN public.profiles p ON p.user_id = sg.guardian_id
    WHERE sg.student_id = v_student_id
      AND sg.guardian_id = auth.uid()
      AND p.account_status = 'active'
  ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT COALESCE((s.value ->> 'paused')::boolean, false)
    INTO v_paused
  FROM public.app_settings s
  WHERE s.key = 'mutabaah_calculation_pause';

  IF COALESCE(v_paused, false) THEN
    RAISE EXCEPTION 'Pengisian Mutabaah sedang dijeda oleh Admin';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_parent_mutabaah_pause_entries ON public.mutabaah_entries;
CREATE TRIGGER trg_guard_parent_mutabaah_pause_entries
BEFORE INSERT OR UPDATE OR DELETE ON public.mutabaah_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_parent_mutabaah_writes_during_pause();

DROP TRIGGER IF EXISTS trg_guard_parent_mutabaah_pause_submissions ON public.mutabaah_day_submissions;
CREATE TRIGGER trg_guard_parent_mutabaah_pause_submissions
BEFORE INSERT OR UPDATE OR DELETE ON public.mutabaah_day_submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_parent_mutabaah_writes_during_pause();

DROP TRIGGER IF EXISTS trg_guard_parent_mutabaah_pause_conditions ON public.mutabaah_day_conditions;
CREATE TRIGGER trg_guard_parent_mutabaah_pause_conditions
BEFORE INSERT OR UPDATE OR DELETE ON public.mutabaah_day_conditions
FOR EACH ROW EXECUTE FUNCTION public.guard_parent_mutabaah_writes_during_pause();
