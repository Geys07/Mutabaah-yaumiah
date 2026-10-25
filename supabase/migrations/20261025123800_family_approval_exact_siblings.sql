-- Tighten same-family approvals: consent is per reviewed sibling, not a
-- blanket yes/no for every future student sharing the number.
CREATE OR REPLACE FUNCTION public.admin_save_parent_family(
  p_student_id uuid,p_contacts jsonb,p_approved_matches jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
 v_rel text;
 v_phone text;
 v_old_phone text;
 v_other text;
 v_preview jsonb;
 v_issue record;
 v_match record;
 v_expected_students jsonb;
 v_user uuid;
 v_linked integer := 0;
 v_matched_id uuid;
 v_matched_rel text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.has_role('admin')
    OR NOT public.qa06_account_active()
 THEN RAISE EXCEPTION 'Hanya Admin aktif dapat menyimpan keluarga' USING ERRCODE='42501'; END IF;
 IF pg_catalog.jsonb_typeof(p_approved_matches) IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Konfirmasi keluarga tidak valid'; END IF;
 -- Serialize all Admin family writes; overlapping sibling edits cannot evade
 -- the preview/consent check by racing from two separate browser sessions.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('family-contact-admin-confirmation'));
 IF NOT EXISTS(SELECT 1 FROM public.students s WHERE s.id=p_student_id)
 THEN RAISE EXCEPTION 'Siswa tidak ditemukan'; END IF;
 -- One parent account is one phone. Avoid silently overwriting relationship
 -- between Ayah and Ibu for the same student.
 FOREACH v_rel IN ARRAY ARRAY['father','mother','guardian'] LOOP
   v_phone := nullif(pg_catalog.btrim(p_contacts->v_rel->>'phone'),'');
   IF v_phone IS NULL THEN CONTINUE; END IF;
   FOREACH v_other IN ARRAY ARRAY['father','mother','guardian'] LOOP
     IF v_other<>v_rel AND v_phone=nullif(pg_catalog.btrim(p_contacts->v_other->>'phone'),'')
     THEN RAISE EXCEPTION 'Nomor HP sama tidak dapat digunakan untuk dua hubungan pada siswa yang sama. Pilih satu hubungan wali.'; END IF;
   END LOOP;
 END LOOP;

 v_preview := public.admin_preview_parent_family(p_student_id,p_contacts);
 FOR v_issue IN SELECT value FROM pg_catalog.jsonb_array_elements(v_preview) LOOP
   -- A confirmation is valid only for the precise siblings shown on screen.
   -- Newly matched students cannot be silently included just because the
   -- phone was previously approved for another sibling.
   SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
     'id',x.value->>'id','relationship',x.value->>'relationship'
   )),'[]'::jsonb) INTO v_expected_students
   FROM pg_catalog.jsonb_array_elements(v_issue.value->'students') AS x(value);
   IF NOT (p_approved_matches @> pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
       'relationship',v_issue.value->>'relationship',
       'phone',v_issue.value->>'phone',
       'students',v_expected_students)
   )) THEN
      RAISE EXCEPTION 'Ada nomor baru yang sama dengan siswa lain. Periksa dan konfirmasikan keluarga lagi sebelum menyimpan.';
   END IF;
 END LOOP;

 -- On changed/cleared phone, invalidate old family consent on *both* ends.
 FOREACH v_rel IN ARRAY ARRAY['father','mother','guardian'] LOOP
   SELECT fc.phone INTO v_old_phone FROM public.student_family_contacts fc
      WHERE fc.student_id=p_student_id AND fc.relationship=v_rel;
   v_phone := nullif(pg_catalog.btrim(p_contacts->v_rel->>'phone'),'');
   IF v_old_phone IS DISTINCT FROM v_phone THEN
      DELETE FROM public.parent_family_consents a WHERE
       (a.student_id=p_student_id AND a.relationship=v_rel)
       OR (a.matched_student_id=p_student_id AND a.matched_relationship=v_rel);
   END IF;
 END LOOP;
 PERFORM public.save_student_family_contacts(p_student_id,p_contacts);

 FOR v_issue IN SELECT value FROM pg_catalog.jsonb_array_elements(v_preview) LOOP
   v_rel := v_issue.value->>'relationship';
   v_phone := v_issue.value->>'phone';
   IF pg_catalog.jsonb_array_length(v_issue.value->'students')=0 THEN
     -- Confirmed registered account, with no other student matching contacts.
     INSERT INTO public.parent_family_consents(
       student_id,relationship,matched_student_id,matched_relationship,phone,confirmed_by)
     VALUES(p_student_id,v_rel,p_student_id,v_rel,v_phone,(SELECT auth.uid()))
     ON CONFLICT(student_id,relationship,matched_student_id,matched_relationship)
       DO UPDATE SET phone=excluded.phone,confirmed_by=excluded.confirmed_by,confirmed_at=now();
   ELSE
     FOR v_match IN SELECT value FROM pg_catalog.jsonb_array_elements(v_issue.value->'students') LOOP
       INSERT INTO public.parent_family_consents(
        student_id,relationship,matched_student_id,matched_relationship,phone,confirmed_by)
       VALUES(p_student_id,v_rel,(v_match.value->>'id')::uuid,v_match.value->>'relationship',v_phone,(SELECT auth.uid()))
       ON CONFLICT(student_id,relationship,matched_student_id,matched_relationship)
          DO UPDATE SET phone=excluded.phone,confirmed_by=excluded.confirmed_by,confirmed_at=now();
     END LOOP;
   END IF;
 END LOOP;

 -- A changed contact cannot leave an unrelated old guardian with child access.
 DELETE FROM public.student_guardians sg
 USING public.profiles prof
 WHERE sg.student_id=p_student_id AND prof.user_id=sg.guardian_id
  AND NOT EXISTS (
    SELECT 1 FROM public.student_family_contacts fc
    WHERE fc.student_id=sg.student_id AND fc.relationship=sg.relationship
      AND fc.phone=prof.phone
  );

 -- Link only explicitly approved contacts to active, already registered parent
 -- accounts; linked sibling contacts included in the same confirmation.
 FOR v_rel IN SELECT unnest(ARRAY['father','mother','guardian']) LOOP
   SELECT fc.phone INTO v_phone FROM public.student_family_contacts fc
    WHERE fc.student_id=p_student_id AND fc.relationship=v_rel;
   IF v_phone IS NULL THEN CONTINUE; END IF;
   IF NOT EXISTS(
     SELECT 1 FROM public.parent_family_consents c
     WHERE c.student_id=p_student_id AND c.relationship=v_rel AND c.phone=v_phone
   ) THEN CONTINUE; END IF;
   SELECT prof.user_id INTO v_user
     FROM public.profiles prof
     JOIN public.user_roles ur ON ur.user_id=prof.user_id AND ur.role='parent'
     WHERE prof.phone=v_phone AND prof.account_status='active';
   IF v_user IS NULL THEN CONTINUE; END IF;
   PERFORM public.admin_link_existing_parent(p_student_id,v_rel);
   v_linked := v_linked+1;
   FOR v_match IN
      SELECT pg_catalog.jsonb_build_object('id',c.matched_student_id,
        'relationship',c.matched_relationship) AS value FROM public.parent_family_consents c
      WHERE c.student_id=p_student_id AND c.relationship=v_rel AND c.phone=v_phone
        AND c.matched_student_id<>p_student_id
   LOOP
     v_matched_id := (v_match.value->>'id')::uuid;
     v_matched_rel := v_match.value->>'relationship';
     IF EXISTS(SELECT 1 FROM public.student_family_contacts f
       WHERE f.student_id=v_matched_id AND f.relationship=v_matched_rel
         AND f.phone=v_phone) THEN
       PERFORM public.admin_link_existing_parent(v_matched_id,v_matched_rel);
       v_linked := v_linked+1;
     END IF;
   END LOOP;
 END LOOP;
 RETURN pg_catalog.jsonb_build_object('success',true,'linked',v_linked);
END;
$body$;

REVOKE ALL ON FUNCTION public.admin_save_parent_family(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_parent_family(uuid,jsonb,jsonb) TO authenticated;
