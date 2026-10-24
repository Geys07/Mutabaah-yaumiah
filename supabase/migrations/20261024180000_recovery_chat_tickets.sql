-- Chat pemulihan kata sandi yang terpisah dari autentikasi biasa.
-- Seluruh akses publik dan admin melewati Edge Function dengan pemeriksaan token/role.
CREATE TABLE IF NOT EXISTS public.recovery_chat_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.password_reset_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  access_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  delete_after timestamptz,
  CONSTRAINT recovery_chat_hash_check CHECK (access_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS recovery_chat_recent_idx
  ON public.recovery_chat_tickets(last_message_at DESC);
CREATE INDEX IF NOT EXISTS recovery_chat_cleanup_idx
  ON public.recovery_chat_tickets(delete_after) WHERE delete_after IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.recovery_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.recovery_chat_tickets(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user','admin','system','code')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 1200),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT recovery_chat_code_unique UNIQUE(ticket_id,id)
);
CREATE INDEX IF NOT EXISTS recovery_chat_messages_order_idx
  ON public.recovery_chat_messages(ticket_id,created_at,id);
CREATE INDEX IF NOT EXISTS recovery_chat_unread_idx
  ON public.recovery_chat_messages(ticket_id,sender) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.recovery_chat_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.recovery_chat_tickets(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (length(endpoint) BETWEEN 20 AND 2048),
  p256dh text NOT NULL CHECK (length(p256dh) BETWEEN 24 AND 256),
  auth_key text NOT NULL CHECK (length(auth_key) BETWEEN 10 AND 256),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recovery_chat_push_ticket_idx
  ON public.recovery_chat_push_subscriptions(ticket_id);

ALTER TABLE public.recovery_chat_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_chat_push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recovery_chat_tickets,public.recovery_chat_messages,public.recovery_chat_push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.recovery_chat_tickets,public.recovery_chat_messages,public.recovery_chat_push_subscriptions TO service_role;

-- Mulai hitungan 30 hari saat Admin memberikan keputusan.
CREATE OR REPLACE FUNCTION public.recovery_chat_mark_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('approved','rejected','revoked','used')
  THEN
    UPDATE public.recovery_chat_tickets t
       SET decided_at = COALESCE(t.decided_at, now()),
           delete_after = COALESCE(t.delete_after, now() + interval '30 days')
     WHERE t.request_id = NEW.id AND t.decided_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS recovery_chat_request_decision ON public.password_reset_requests;
CREATE TRIGGER recovery_chat_request_decision
AFTER UPDATE OF status ON public.password_reset_requests
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.recovery_chat_mark_decision();
REVOKE ALL ON FUNCTION public.recovery_chat_mark_decision() FROM PUBLIC,anon,authenticated;

-- Ketika tiket dipangkas, batalkan kode approved yang tersisa supaya akun
-- dapat membuat permohonan baru. Status audit permintaan tetap disimpan.
CREATE OR REPLACE FUNCTION public.cleanup_recovery_chats()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $
BEGIN
  UPDATE public.password_reset_requests r
    SET status = 'revoked', lock_reason = 'Tiket chat melewati masa simpan 30 hari'
    FROM public.recovery_chat_tickets t
    WHERE t.request_id = r.id AND r.status = 'approved'
      AND t.delete_after IS NOT NULL AND t.delete_after <= now();
  DELETE FROM public.recovery_chat_tickets
    WHERE delete_after IS NOT NULL AND delete_after <= now();
END;
$;
REVOKE ALL ON FUNCTION public.cleanup_recovery_chats() FROM PUBLIC,anon,authenticated;

-- Hapus chat, langganan push chat dan pesannya; pertahankan status audit.
DO $job$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname = 'mutabaah_recovery_chat_cleanup_0817_wib') THEN
    PERFORM cron.schedule(
      'mutabaah_recovery_chat_cleanup_0817_wib',
      '17 1 * * *',
      'SELECT public.cleanup_recovery_chats()'
    );
  END IF;
END $job$;
