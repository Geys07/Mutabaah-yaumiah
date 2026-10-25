-- Account activation for the first child remains unchanged.
-- Subsequent linking of an already-active parent is exclusively an Admin action.
CREATE OR REPLACE FUNCTION public.admin_link_existing_parent(
 p_student_id uuid,
 p_relationship text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
 v_phone text;
 v_guardian uuid;
 v_existing uuid;
 v_already boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role('admin')
   OR NOT public.qa06_account_active()
 THEN RAISE EXCEPTION 'Hanya Admin aktif yang dapat menghubungkan anak'; END IF;
 IF p_student_id IS NULL OR p_relationship NOT IN ('father','mother','guardian')
 THEN RAISE EXCEPTION 'Data siswa/hubungan tidak valid'; END IF;

 SELECT fc.phone INTO v_phone FROM public.student_family_contacts fc
 WHERE fc.student_id=p_student_id AND fc.relationship=p_relationship
 FOR UPDATE;
 IF v_phone IS NULL OR v_phone !~ '^08[0-9]{8,11}$' THEN
   RAISE EXCEPTION 'Lengkapi nomor HP kontak terlebih dahulu';
 END IF;

 SELECT p.user_id INTO v_guardian FROM public.profiles p
 WHERE p.phone=v_phone AND p.account_status='active';
 IF v_guardian IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.user_roles ur
   WHERE ur.user_id=v_guardian AND ur.role='parent'
 ) THEN
   RAISE EXCEPTION 'Belum ada akun orang tua aktif untuk nomor tersebut. Gunakan Aktivasi Orang Tua dahulu';
 END IF;

 SELECT sg.guardian_id INTO v_existing
 FROM public.student_guardians sg
 WHERE sg.student_id=p_student_id AND sg.relationship=p_relationship
 LIMIT 1 FOR UPDATE;
 IF EXISTS (
   SELECT 1 FROM public.student_guardians sg
   WHERE sg.student_id=p_student_id AND sg.relationship=p_relationship
     AND sg.guardian_id<>v_guardian
 ) THEN RAISE EXCEPTION 'Hubungan ini sudah terpasang pada akun lain. Periksa dulu lewat Admin'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.student_guardians sg
   WHERE sg.student_id=p_student_id AND sg.guardian_id=v_guardian
     AND sg.relationship<>p_relationship
 ) THEN RAISE EXCEPTION 'Akun ini telah terhubung melalui hubungan lain. Periksa dulu data Admin'; END IF;
 SELECT EXISTS(
   SELECT 1 FROM public.student_guardians
   WHERE student_id=p_student_id AND guardian_id=v_guardian
     AND relationship=p_relationship
 ) INTO v_already;

 INSERT INTO public.student_guardians(student_id,guardian_id,relationship)
 VALUES(p_student_id,v_guardian,p_relationship)
 ON CONFLICT(student_id,guardian_id)
 DO UPDATE SET relationship=EXCLUDED.relationship;

 -- A code for this exact phone/contact is no longer needed once linked.
 UPDATE public.parent_activation_codes
 SET used_at=now()
 WHERE student_id=p_student_id AND relationship=p_relationship
   AND phone=v_phone AND used_at IS NULL;
 RETURN pg_catalog.jsonb_build_object(
  'success',true,'already_linked',v_already
 );
END
$function$;

REVOKE ALL ON FUNCTION public.admin_link_existing_parent(uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_link_existing_parent(uuid,text)
 TO authenticated;

-- Parent must not be able to claim *additional* children through an old
-- authenticated RPC (the separate first-time activation flow is unaffected).
REVOKE ALL ON FUNCTION public.claim_parent_activation(text)
 FROM PUBLIC,anon,authenticated;
