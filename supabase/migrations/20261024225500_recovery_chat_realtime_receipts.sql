-- Realtime signals contain no identity, message, password or recovery code.
-- Channels are random bearer-scoped topics; every message is still fetched through
-- an authorized Edge Function (Admin role or a valid 256-bit applicant ticket).
ALTER TABLE public.recovery_chat_tickets
  ADD COLUMN IF NOT EXISTS realtime_key text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex');
ALTER TABLE public.recovery_chat_messages
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_for_admin_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS recovery_chat_client_idempotency_idx
  ON public.recovery_chat_messages(ticket_id,sender,client_id)
  WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS recovery_chat_admin_visible_idx
  ON public.recovery_chat_messages(ticket_id,created_at)
  WHERE deleted_for_admin_at IS NULL;

CREATE TABLE IF NOT EXISTS public.recovery_chat_admin_signal (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  realtime_key text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex')
);
ALTER TABLE public.recovery_chat_admin_signal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recovery_chat_admin_signal FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.recovery_chat_admin_signal TO service_role;
INSERT INTO public.recovery_chat_admin_signal(singleton) VALUES(true)
  ON CONFLICT(singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.recovery_chat_realtime_signal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $body$
DECLARE
  channel_key text;
  admin_key text;
  changed_ticket uuid;
BEGIN
  IF TG_TABLE_NAME = 'recovery_chat_messages' THEN
    IF TG_OP = 'UPDATE'
      AND OLD.read_at IS NOT DISTINCT FROM NEW.read_at
      AND OLD.delivered_at IS NOT DISTINCT FROM NEW.delivered_at
      AND OLD.deleted_for_admin_at IS NOT DISTINCT FROM NEW.deleted_for_admin_at
    THEN RETURN NEW; END IF;
    changed_ticket := NEW.ticket_id;
  ELSE
    changed_ticket := NEW.id;
  END IF;

  SELECT t.realtime_key INTO channel_key
  FROM public.recovery_chat_tickets t WHERE t.id=changed_ticket;
  IF channel_key IS NOT NULL THEN
    PERFORM realtime.send('{"version":1}'::jsonb,'refresh',
       'recovery-chat-' || channel_key,false);
  END IF;
  SELECT s.realtime_key INTO admin_key
  FROM public.recovery_chat_admin_signal s WHERE s.singleton=true;
  IF admin_key IS NOT NULL THEN
    PERFORM realtime.send('{"version":1}'::jsonb,'refresh',
       'recovery-chat-admin-' || admin_key,false);
  END IF;
  RETURN NEW;
END;
$body$;

DROP TRIGGER IF EXISTS recovery_chat_messages_realtime ON public.recovery_chat_messages;
CREATE TRIGGER recovery_chat_messages_realtime
AFTER INSERT OR UPDATE OF delivered_at,read_at,deleted_for_admin_at
ON public.recovery_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.recovery_chat_realtime_signal();

DROP TRIGGER IF EXISTS recovery_chat_ticket_realtime ON public.recovery_chat_tickets;
CREATE TRIGGER recovery_chat_ticket_realtime AFTER INSERT
ON public.recovery_chat_tickets
FOR EACH ROW EXECUTE FUNCTION public.recovery_chat_realtime_signal();
REVOKE ALL ON FUNCTION public.recovery_chat_realtime_signal() FROM PUBLIC,anon,authenticated;
