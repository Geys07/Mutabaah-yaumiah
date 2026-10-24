-- Applied via Supabase migration on 24 October 2026.
-- Role-scoped bulk issuance, preserving active codes/accounts; no new rows on installation.

CREATE OR REPLACE FUNCTION public.list_parent_activation_batch(p_class_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(student_id uuid, student_name text, nis text, class_name text, relationship text, contact_name text, phone text, activation_code text, expires_at timestamp with time zone, code_state text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 WITH scoped AS (
  SELECT DISTINCT ON (fc.student_id, fc.relationship)
    fc.student_id, s.full_name AS student_name, s.nis, cl.name AS class_name,
    fc.relationship, fc.full_name AS contact_name, fc.phone
  FROM public.student_family_contacts fc
  JOIN public.students s ON s.id=fc.student_id AND s.status='active'
  JOIN public.student_enrollments en ON en.student_id=s.id AND en.ends_on IS NULL
  JOIN public.classes cl ON cl.id=en.class_id
  WHERE public.qa06_account_active()
    AND (
      public.has_role('admin')
      OR (public.has_role('homeroom_teacher')
          AND EXISTS(
            SELECT 1 FROM public.homeroom_assignments h
            WHERE h.class_id=cl.id AND h.teacher_id=(SELECT auth.uid())
          ))
    )
    AND (p_class_id IS NULL OR cl.id=p_class_id)
  ORDER BY fc.student_id,fc.relationship,en.starts_on DESC,en.id DESC
 ),
 states AS (
  SELECT sc.*,ac.code AS existing_code,ac.expires_at AS code_expiry,
   CASE
    WHEN EXISTS(
      SELECT 1 FROM public.student_guardians sg
      JOIN public.profiles prof ON prof.user_id=sg.guardian_id
      WHERE sg.student_id=sc.student_id
        AND sg.relationship=sc.relationship
        AND prof.account_status='active'
    ) THEN 'linked'
    WHEN sc.phone IS NOT NULL AND EXISTS(
      SELECT 1 FROM public.profiles prof
      WHERE prof.phone=sc.phone
    ) THEN 'needs_link'
    WHEN coalesce(pg_catalog.btrim(sc.contact_name),'')=''
       OR sc.phone IS NULL OR sc.phone !~ '^08[0-9]{8,11}$' THEN 'incomplete'
    WHEN ac.code IS NOT NULL AND ac.used_at IS NULL
      AND ac.expires_at>now() AND ac.phone=sc.phone THEN 'active'
    ELSE 'ready'
   END AS next_state
  FROM scoped sc
  LEFT JOIN public.parent_activation_codes ac
    ON ac.student_id=sc.student_id AND ac.relationship=sc.relationship
 )
 SELECT st.student_id,st.student_name,st.nis,st.class_name,st.relationship,
  st.contact_name,st.phone,
  CASE WHEN st.next_state='active' THEN st.existing_code ELSE NULL::text END,
  CASE WHEN st.next_state='active' THEN st.code_expiry ELSE NULL::timestamptz END,
  st.next_state
 FROM states st
 ORDER BY st.class_name,st.student_name,st.relationship
$function$;

CREATE OR REPLACE FUNCTION public.issue_parent_activation_batch(p_class_id uuid DEFAULT NULL::uuid, p_student_id uuid DEFAULT NULL::uuid, p_relationship text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_row record;
 v_code text;
 v_bytes bytea;
 v_candidate integer;
 v_attempt integer;
 v_total integer;
 v_created integer := 0;
 v_affected integer;
BEGIN
 IF NOT public.qa06_account_active()
   OR NOT (public.has_role('admin') OR public.has_role('homeroom_teacher')) THEN
  RAISE EXCEPTION 'Akses pembuatan kode tidak diizinkan' USING ERRCODE='42501';
 END IF;
 IF (p_student_id IS NULL) <> (p_relationship IS NULL) THEN
  RAISE EXCEPTION 'Pilih siswa dan hubungan wali bersama';
 END IF;
 IF p_relationship IS NOT NULL AND p_relationship NOT IN ('father','mother','guardian') THEN
  RAISE EXCEPTION 'Hubungan wali tidak dikenal';
 END IF;
 IF p_class_id IS NOT NULL
   AND NOT public.has_role('admin')
   AND NOT EXISTS(
    SELECT 1 FROM public.homeroom_assignments h
    WHERE h.class_id=p_class_id AND h.teacher_id=(SELECT auth.uid())
   ) THEN
  RAISE EXCEPTION 'Kelas di luar penugasan wali kelas' USING ERRCODE='42501';
 END IF;
 -- Serialisasi sesuai RPC pembuatan kode satuan yang sudah ada.
 PERFORM pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('parent_activation_code_creation')
 );
 SELECT count(*) INTO v_total FROM public.list_parent_activation_batch(p_class_id);
 IF v_total > 500 THEN
  RAISE EXCEPTION 'Terlalu banyak kontak. Pilih satu kelas untuk memproses maksimal 500 kontak.';
 END IF;
 IF p_student_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.list_parent_activation_batch(p_class_id) t
   WHERE t.student_id=p_student_id AND t.relationship=p_relationship
 ) THEN
  RAISE EXCEPTION 'Kontak tidak tersedia pada kelas yang diizinkan' USING ERRCODE='42501';
 END IF;

 FOR v_row IN
  SELECT t.* FROM public.list_parent_activation_batch(p_class_id) t
  WHERE t.code_state='ready'
    AND (p_student_id IS NULL OR (t.student_id=p_student_id AND t.relationship=p_relationship))
  ORDER BY t.student_id,t.relationship
 LOOP
  -- Baris sumber dilihat ulang saat write. Jangan mendaur ulang kode yang sudah aktif.
  FOR v_attempt IN 1..100 LOOP
   v_code := '';
   WHILE length(v_code)<4 LOOP
    v_bytes := extensions.gen_random_bytes(1);
    v_candidate := pg_catalog.get_byte(v_bytes,0);
    IF v_candidate < 234 THEN
      v_code := v_code || chr(97+(v_candidate % 26));
    END IF;
   END LOOP;
   EXIT WHEN NOT EXISTS(SELECT 1 FROM public.parent_activation_codes ac WHERE ac.code=v_code);
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.parent_activation_codes ac WHERE ac.code=v_code) THEN
    RAISE EXCEPTION 'Gagal mendapatkan kode aktivasi unik, silakan coba lagi';
  END IF;
  INSERT INTO public.parent_activation_codes(
    student_id, relationship, phone, code, expires_at, used_at, created_at
  ) VALUES(
    v_row.student_id,v_row.relationship,v_row.phone,v_code,
    now()+interval '14 days',NULL,now()
  )
  ON CONFLICT(student_id,relationship) DO UPDATE
    SET phone=excluded.phone,code=excluded.code,
        expires_at=excluded.expires_at,used_at=NULL,created_at=now()
    WHERE NOT(
      public.parent_activation_codes.phone=excluded.phone
      AND public.parent_activation_codes.used_at IS NULL
      AND public.parent_activation_codes.expires_at>now()
    );
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  v_created := v_created + v_affected;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object('created',v_created,'scope_total',v_total);
END
$function$;

REVOKE ALL ON FUNCTION public.list_parent_activation_batch(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.issue_parent_activation_batch(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_parent_activation_batch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_parent_activation_batch(uuid,uuid,text) TO authenticated;
