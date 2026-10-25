-- Keep the guardian account and every explicitly confirmed sibling contact
-- on the same phone. Unconfirmed contacts with the same number are untouched.
CREATE OR REPLACE FUNCTION public.admin_review_parent_phone_request(
  p_admin_id uuid,p_request_id uuid,p_approve boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
 v_req public.parent_phone_change_requests%ROWTYPE;
 v_updated_contacts integer := 0;
BEGIN
 IF auth.role()<>'service_role' THEN
   RAISE EXCEPTION 'Proses persetujuan tidak diizinkan';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id
   WHERE r.user_id=p_admin_id AND r.role='admin' AND p.account_status='active'
 ) THEN RAISE EXCEPTION 'Akun Admin tidak valid'; END IF;

 SELECT * INTO v_req FROM public.parent_phone_change_requests
 WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.status<>'pending' THEN
   RAISE EXCEPTION 'Permohonan tidak ditemukan atau sudah diproses';
 END IF;

 IF p_approve IS TRUE THEN
   IF EXISTS(
     SELECT 1 FROM public.profiles
     WHERE phone=v_req.new_phone AND user_id<>v_req.guardian_id
   ) THEN RAISE EXCEPTION 'Nomor HP sudah digunakan akun lain'; END IF;

   UPDATE public.profiles SET phone=v_req.new_phone
   WHERE user_id=v_req.guardian_id
     AND account_status='active' AND phone=v_req.old_phone;
   IF NOT FOUND THEN
     RAISE EXCEPTION 'Nomor lama berubah atau akun tidak aktif, muat ulang';
   END IF;

   WITH RECURSIVE family_links(student_id,relationship) AS (
     SELECT sg.student_id,sg.relationship
     FROM public.student_guardians sg
     WHERE sg.guardian_id=v_req.guardian_id
     UNION
     SELECT
       CASE WHEN c.student_id=f.student_id AND c.relationship=f.relationship
         THEN c.matched_student_id ELSE c.student_id END,
       CASE WHEN c.student_id=f.student_id AND c.relationship=f.relationship
         THEN c.matched_relationship ELSE c.relationship END
     FROM family_links f
     JOIN public.parent_family_consents c
       ON c.phone=v_req.old_phone
      AND (
        (c.student_id=f.student_id AND c.relationship=f.relationship)
        OR
        (c.matched_student_id=f.student_id AND c.matched_relationship=f.relationship)
      )
   ),
   changed_contacts AS (
     UPDATE public.student_family_contacts fc
       SET phone=v_req.new_phone,updated_at=now()
     FROM family_links fl
     WHERE fc.student_id=fl.student_id
       AND fc.relationship=fl.relationship
       AND fc.phone=v_req.old_phone
     RETURNING fc.student_id,fc.relationship
   ),
   changed_consents AS (
     UPDATE public.parent_family_consents c
       SET phone=v_req.new_phone
     WHERE c.phone=v_req.old_phone
       AND EXISTS(
         SELECT 1 FROM family_links fl
         WHERE fl.student_id=c.student_id AND fl.relationship=c.relationship
       )
       AND EXISTS(
         SELECT 1 FROM family_links fl
         WHERE fl.student_id=c.matched_student_id
           AND fl.relationship=c.matched_relationship
       )
     RETURNING c.student_id
   ),
   invalidated_codes AS (
     UPDATE public.parent_activation_codes pc
       SET used_at=now()
     WHERE pc.phone=v_req.old_phone AND pc.used_at IS NULL
       AND EXISTS(
         SELECT 1 FROM family_links fl
         WHERE fl.student_id=pc.student_id AND fl.relationship=pc.relationship
       )
     RETURNING pc.student_id
   )
   SELECT count(*) INTO v_updated_contacts FROM changed_contacts;
 END IF;

 UPDATE public.parent_phone_change_requests
 SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
     reviewed_at=now(),reviewed_by=p_admin_id
 WHERE id=p_request_id;

 RETURN jsonb_build_object(
   'success',true,
   'status',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
   'synced_contacts',v_updated_contacts
 );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_review_parent_phone_request(uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_parent_phone_request(uuid,uuid,boolean)
 TO service_role;
