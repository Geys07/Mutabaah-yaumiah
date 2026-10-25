-- Return canonical names so an existing guardian is never retyped for each sibling.
CREATE OR REPLACE FUNCTION public.admin_preview_parent_family(
  p_student_id uuid,p_contacts jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
 v_rel text;
 v_phone text;
 v_arr jsonb := '[]'::jsonb;
 v_matches jsonb;
 v_registered boolean;
 v_registered_name text;
 v_confirmed boolean;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.has_role('admin')
   OR NOT public.qa06_account_active()
 THEN RAISE EXCEPTION 'Hanya Admin aktif yang dapat memeriksa data keluarga' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.id=p_student_id)
 THEN RAISE EXCEPTION 'Siswa tidak ditemukan'; END IF;
 IF pg_catalog.jsonb_typeof(p_contacts) IS DISTINCT FROM 'object'
   OR EXISTS(SELECT 1 FROM pg_catalog.jsonb_object_keys(p_contacts) k
             WHERE k NOT IN ('father','mother','guardian'))
 THEN RAISE EXCEPTION 'Format keluarga tidak sesuai'; END IF;

 FOREACH v_rel IN ARRAY ARRAY['father','mother','guardian'] LOOP
  v_phone := NULLIF(pg_catalog.btrim(p_contacts->v_rel->>'phone'),'');
  IF v_phone IS NULL THEN CONTINUE; END IF;
  IF v_phone !~ '^08[0-9]{8,11}$'
  THEN RAISE EXCEPTION 'Periksa nomor HP %',v_rel; END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(DISTINCT pg_catalog.jsonb_build_object(
    'id', s.id,'name',s.full_name,'contact_name',fc.full_name,
    'relationship',fc.relationship,
    'class_name',coalesce((
       SELECT cl.name FROM public.student_enrollments en
       JOIN public.classes cl ON cl.id=en.class_id
       WHERE en.student_id=s.id AND en.ends_on IS NULL
       ORDER BY en.starts_on DESC LIMIT 1
    ),'Tanpa kelas')
   )),'[]'::jsonb) INTO v_matches
   FROM public.student_family_contacts fc
   JOIN public.students s ON s.id=fc.student_id
   WHERE fc.phone=v_phone AND fc.student_id<>p_student_id
    AND NOT EXISTS(
      SELECT 1 FROM public.parent_family_consents a
      WHERE a.student_id=p_student_id AND a.relationship=v_rel
        AND a.phone=v_phone
        AND a.matched_student_id=fc.student_id
        AND a.matched_relationship=fc.relationship
    );

  SELECT prof.full_name INTO v_registered_name
   FROM public.profiles prof
   JOIN public.user_roles ur ON ur.user_id=prof.user_id AND ur.role='parent'
   WHERE prof.phone=v_phone AND prof.account_status='active'
   ORDER BY prof.created_at,prof.user_id
   LIMIT 1;

  SELECT EXISTS(
   SELECT 1 FROM public.profiles prof
   JOIN public.user_roles ur ON ur.user_id=prof.user_id AND ur.role='parent'
   WHERE prof.phone=v_phone AND prof.account_status='active'
     AND NOT EXISTS(
       SELECT 1 FROM public.student_guardians sg
       WHERE sg.student_id=p_student_id AND sg.guardian_id=prof.user_id
         AND sg.relationship=v_rel
     )
  ) INTO v_registered;
  SELECT EXISTS(
   SELECT 1 FROM public.parent_family_consents a
   WHERE a.student_id=p_student_id AND a.relationship=v_rel AND a.phone=v_phone
  ) INTO v_confirmed;
  IF pg_catalog.jsonb_array_length(v_matches)>0 OR (v_registered AND NOT v_confirmed) THEN
   v_arr := v_arr || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
       'relationship',v_rel,'phone',v_phone,'students',v_matches,
       'registered_account',v_registered,'registered_name',v_registered_name)
   );
  END IF;
 END LOOP;
 RETURN v_arr;
END;
$body$;

REVOKE ALL ON FUNCTION public.admin_preview_parent_family(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_parent_family(uuid,jsonb) TO authenticated;
