-- Applied to the authorized Supabase project on 24 October 2026.
-- Resolve only notifications linked to the request actually handled.
-- Existing unlinked legacy request messages are marked read only with no pending request.
ALTER TABLE public.admin_notice_inbox ADD COLUMN IF NOT EXISTS related_request_id uuid;
CREATE INDEX IF NOT EXISTS admin_notice_source_request_unread_idx
 ON public.admin_notice_inbox(source,related_request_id)
 WHERE read_at IS NULL AND related_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_notice_new_account_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status='pending' THEN
    INSERT INTO public.admin_notice_inbox(user_id,source,title,body,related_request_id)
    SELECT ur.user_id,'account','Permintaan pemulihan akun',
       'Ada permintaan pemulihan kata sandi baru. Periksa menu Permintaan Akun.',
       NEW.id
    FROM public.user_roles ur
    JOIN public.profiles pr ON pr.user_id=ur.user_id
    WHERE ur.role='admin' AND pr.account_status='active';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_notice_new_phone_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status='pending' THEN
    INSERT INTO public.admin_notice_inbox(user_id,source,title,body,related_request_id)
    SELECT ur.user_id,'phone','Permintaan perubahan nomor HP',
       'Ada permintaan perubahan nomor HP wali murid. Periksa menu Perubahan Nomor.',
       NEW.id
    FROM public.user_roles ur
    JOIN public.profiles pr ON pr.user_id=ur.user_id
    WHERE ur.role='admin' AND pr.account_status='active';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_notice_resolve_completed_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_source text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR NEW.status NOT IN ('approved','rejected','revoked','used') THEN
    RETURN NEW;
  END IF;
  v_source := CASE TG_TABLE_NAME
    WHEN 'parent_phone_change_requests' THEN 'phone'
    WHEN 'password_reset_requests' THEN 'account'
    ELSE NULL END;
  IF v_source IS NULL THEN RETURN NEW; END IF;

  UPDATE public.admin_notice_inbox n
  SET read_at=now()
  WHERE n.source=v_source AND n.related_request_id=NEW.id
    AND n.read_at IS NULL;

  -- Pesan historis dari versi lama belum memiliki request_id.
  -- Tutup hanya jika tidak ada permohonan kategori itu yang menunggu;
  -- jangan sampai notifikasi lain yang masih perlu ditindak ikut hilang.
  IF v_source='phone' AND NOT EXISTS(
    SELECT 1 FROM public.parent_phone_change_requests r WHERE r.status='pending'
  ) THEN
    UPDATE public.admin_notice_inbox n SET read_at=now()
    WHERE n.source='phone' AND n.related_request_id IS NULL AND n.read_at IS NULL;
  ELSIF v_source='account' AND NOT EXISTS(
    SELECT 1 FROM public.password_reset_requests r WHERE r.status IN('pending','processing')
  ) THEN
    UPDATE public.admin_notice_inbox n SET read_at=now()
    WHERE n.source='account' AND n.related_request_id IS NULL AND n.read_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS admin_notice_phone_request_resolved ON public.parent_phone_change_requests;
CREATE TRIGGER admin_notice_phone_request_resolved
 AFTER UPDATE OF status ON public.parent_phone_change_requests
 FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION public.admin_notice_resolve_completed_request();

DROP TRIGGER IF EXISTS admin_notice_account_request_resolved ON public.password_reset_requests;
CREATE TRIGGER admin_notice_account_request_resolved
 AFTER UPDATE OF status ON public.password_reset_requests
 FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION public.admin_notice_resolve_completed_request();

REVOKE ALL ON FUNCTION public.admin_notice_resolve_completed_request() FROM PUBLIC,anon,authenticated;
UPDATE public.admin_notice_inbox n SET read_at=now()
 WHERE n.source='phone' AND n.related_request_id IS NULL AND n.read_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM public.parent_phone_change_requests r WHERE r.status='pending');
UPDATE public.admin_notice_inbox n SET read_at=now()
 WHERE n.source='account' AND n.related_request_id IS NULL AND n.read_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM public.password_reset_requests r WHERE r.status IN('pending','processing'));
