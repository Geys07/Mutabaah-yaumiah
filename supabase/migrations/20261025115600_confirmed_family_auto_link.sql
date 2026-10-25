-- Explicit Admin family consent. No existing contacts/accounts are changed by installation.
CREATE TABLE IF NOT EXISTS public.parent_family_consents (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('father','mother','guardian')),
  matched_student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  matched_relationship text NOT NULL CHECK (matched_relationship IN ('father','mother','guardian')),
  phone text NOT NULL CHECK (phone ~ '^08[0-9]{8,11}$'),
  confirmed_by uuid NOT NULL REFERENCES public.profiles(user_id),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(student_id,relationship,matched_student_id,matched_relationship)
);
CREATE INDEX IF NOT EXISTS parent_family_consents_reference_idx
  ON public.parent_family_consents(matched_student_id,matched_relationship,phone);
ALTER TABLE public.parent_family_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parent_family_consents FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.parent_family_consents TO service_role;

-- Preview exposes names only to authorized active Admins, never to anonymous users
-- or parents. Previously approved exact sibling/phone pairs are omitted.
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
    'id', s.id,'name',s.full_name,'relationship',fc.relationship,
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
       'registered_account',v_registered)
   );
  END IF;
 END LOOP;
 RETURN v_arr;
END;
$body$;

-- Save + verified family linking is one database transaction.
-- A "No" selection never writes an account link or a new contact record.
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
 v_issue jsonb;
 v_match jsonb;
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
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('family-contact:'||p_student_id::text));
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
   IF NOT (p_approved_matches @> pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('relationship',v_issue->>'relationship','phone',v_issue->>'phone')
   )) THEN
      RAISE EXCEPTION 'Nomor dipakai keluarga lain. Konfirmasikan hubungan keluarga sebelum menyimpan.';
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
   v_rel := v_issue->>'relationship';
   v_phone := v_issue->>'phone';
   IF pg_catalog.jsonb_array_length(v_issue->'students')=0 THEN
     -- Confirmed registered account, with no other student matching contacts.
     INSERT INTO public.parent_family_consents(
       student_id,relationship,matched_student_id,matched_relationship,phone,confirmed_by)
     VALUES(p_student_id,v_rel,p_student_id,v_rel,v_phone,(SELECT auth.uid()))
     ON CONFLICT(student_id,relationship,matched_student_id,matched_relationship)
       DO UPDATE SET phone=excluded.phone,confirmed_by=excluded.confirmed_by,confirmed_at=now();
   ELSE
     FOR v_match IN SELECT value FROM pg_catalog.jsonb_array_elements(v_issue->'students') LOOP
       INSERT INTO public.parent_family_consents(
        student_id,relationship,matched_student_id,matched_relationship,phone,confirmed_by)
       VALUES(p_student_id,v_rel,(v_match->>'id')::uuid,v_match->>'relationship',v_phone,(SELECT auth.uid()))
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
        'relationship',c.matched_relationship) FROM public.parent_family_consents c
      WHERE c.student_id=p_student_id AND c.relationship=v_rel AND c.phone=v_phone
        AND c.matched_student_id<>p_student_id
   LOOP
     v_matched_id := (v_match->>'id')::uuid;
     v_matched_rel := v_match->>'relationship';
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

-- On first account activation or subsequent claim, silently attach only
-- sibling links that the Admin previously confirmed and remain phone-matched.
CREATE OR REPLACE FUNCTION public.link_confirmed_family_on_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
 v_phone text;
 v_row record;
BEGIN
 IF pg_catalog.pg_trigger_depth()>1 THEN RETURN NEW; END IF;
 SELECT p.phone INTO v_phone FROM public.profiles p
 JOIN public.user_roles ur ON ur.user_id=p.user_id AND ur.role='parent'
 WHERE p.user_id=NEW.guardian_id AND p.account_status='active';
 IF v_phone IS NULL THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.student_family_contacts fc
     WHERE fc.student_id=NEW.student_id AND fc.relationship=NEW.relationship AND fc.phone=v_phone)
 THEN RETURN NEW; END IF;
 FOR v_row IN
  SELECT DISTINCT
   CASE WHEN c.student_id=NEW.student_id AND c.relationship=NEW.relationship
     THEN c.matched_student_id ELSE c.student_id END AS sid,
   CASE WHEN c.student_id=NEW.student_id AND c.relationship=NEW.relationship
     THEN c.matched_relationship ELSE c.relationship END AS rel
  FROM public.parent_family_consents c
  WHERE c.phone=v_phone
    AND ((c.student_id=NEW.student_id AND c.relationship=NEW.relationship)
      OR (c.matched_student_id=NEW.student_id AND c.matched_relationship=NEW.relationship))
 LOOP
  IF v_row.sid=NEW.student_id THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.student_family_contacts fc
     WHERE fc.student_id=v_row.sid AND fc.relationship=v_row.rel AND fc.phone=v_phone)
  THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.student_guardians sg
     WHERE sg.student_id=v_row.sid AND sg.relationship=v_row.rel
       AND sg.guardian_id<>NEW.guardian_id)
  THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.student_guardians sg
     WHERE sg.student_id=v_row.sid AND sg.guardian_id=NEW.guardian_id
       AND sg.relationship<>v_row.rel)
  THEN CONTINUE; END IF;
  INSERT INTO public.student_guardians(student_id,guardian_id,relationship)
    VALUES(v_row.sid,NEW.guardian_id,v_row.rel)
    ON CONFLICT(student_id,guardian_id) DO NOTHING;
  UPDATE public.parent_activation_codes ac SET used_at=now()
   WHERE ac.student_id=v_row.sid AND ac.relationship=v_row.rel
     AND ac.phone=v_phone AND ac.used_at IS NULL;
 END LOOP;
 RETURN NEW;
END;
$body$;
DROP TRIGGER IF EXISTS confirmed_family_sibling_activation ON public.student_guardians;
CREATE TRIGGER confirmed_family_sibling_activation
AFTER INSERT ON public.student_guardians FOR EACH ROW
EXECUTE FUNCTION public.link_confirmed_family_on_activation();

REVOKE ALL ON FUNCTION public.admin_preview_parent_family(uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_save_parent_family(uuid,jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.link_confirmed_family_on_activation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_preview_parent_family(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_parent_family(uuid,jsonb,jsonb) TO authenticated;
