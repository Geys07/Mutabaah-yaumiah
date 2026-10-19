-- Ledger/RPC implementation, installed through the versioned post-QA06 migration.
-- Project: vxfpwzevatwucvmeszen. No existing trigger/RLS/target policy is changed.
BEGIN;
ALTER TABLE public.parent_reminder_deliveries
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'uncertain',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS retry_safe boolean NOT NULL DEFAULT false;
-- Existing rows stay conservative: never automatically reclaim old claims/failures.

CREATE OR REPLACE FUNCTION public.list_parent_reminder_targets_page(
  p_date date, p_after uuid DEFAULT NULL, p_limit integer DEFAULT 500
) RETURNS TABLE(guardian_id uuid, pending_children integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.guardian_id, t.pending_children
  FROM public.list_parent_reminder_targets(p_date) t
  WHERE (p_after IS NULL OR t.guardian_id > p_after)
    AND NOT EXISTS (SELECT 1 FROM public.parent_reminder_deliveries d
      WHERE d.guardian_id=t.guardian_id AND d.reminder_date=p_date
      AND NOT (d.attempts<3 AND (
        (d.status='failed' AND d.retry_safe AND d.attempted_at<pg_catalog.now()-interval '2 minutes')
        OR (d.status='claimed' AND d.phase='prepared' AND d.lease_until<pg_catalog.now())
      )))
  ORDER BY t.guardian_id
  LIMIT LEAST(500, GREATEST(1, COALESCE(p_limit,500)));
$$;

CREATE OR REPLACE FUNCTION public.parent_reminder_pending_qa05(p_guardian uuid, p_date date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT t.pending_children FROM public.list_parent_reminder_targets(p_date) t
    WHERE t.guardian_id=p_guardian),0);
$$;

CREATE OR REPLACE FUNCTION public.claim_parent_reminder_qa05(p_guardian uuid, p_date date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_token uuid := pg_catalog.gen_random_uuid(); v_claim uuid;
BEGIN
  IF p_date IS DISTINCT FROM (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::date
     OR (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::time < time '20:00'
     OR (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::time >= time '20:16' THEN
    RETURN NULL;
  END IF;
  IF public.parent_reminder_pending_qa05(p_guardian,p_date)<=0 THEN RETURN NULL; END IF;
  INSERT INTO public.parent_reminder_deliveries AS d
    (guardian_id,reminder_date,status,attempted_at,claim_token,phase,attempts,lease_until,retry_safe)
  VALUES (p_guardian,p_date,'claimed',pg_catalog.now(),v_token,'prepared',1,pg_catalog.now()+interval '60 seconds',false)
  ON CONFLICT (guardian_id,reminder_date) DO UPDATE SET
    status='claimed', attempted_at=pg_catalog.now(), claim_token=v_token, phase='prepared',
    attempts=d.attempts+1, lease_until=pg_catalog.now()+interval '60 seconds', retry_safe=false, error=NULL
  WHERE d.attempts<3 AND (
    (d.status='failed' AND d.retry_safe AND d.attempted_at<pg_catalog.now()-interval '2 minutes')
    OR (d.status='claimed' AND d.phase='prepared' AND d.lease_until<pg_catalog.now())
  ) RETURNING d.claim_token INTO v_claim;
  RETURN v_claim;
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_parent_reminder_qa05(p_guardian uuid,p_date date,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.parent_reminder_pending_qa05(p_guardian,p_date)<=0
    OR p_date IS DISTINCT FROM (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::date
    OR (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::time < time '20:00'
    OR (pg_catalog.now() AT TIME ZONE 'Asia/Jakarta')::time >= time '20:16' THEN RETURN false; END IF;
  UPDATE public.parent_reminder_deliveries SET phase='sending',retry_safe=false
  WHERE guardian_id=p_guardian AND reminder_date=p_date AND claim_token=p_token
    AND status='claimed' AND phase='prepared' AND lease_until>=pg_catalog.now();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_parent_reminder_qa05(
  p_guardian uuid,p_date date,p_token uuid,p_status text,p_safe boolean,p_code text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_status NOT IN ('sent','failed') OR (p_code IS NOT NULL AND p_code NOT IN
    ('no_devices','no_longer_eligible','delivery_uncertain','expired_devices','read_failed')) THEN
    RAISE EXCEPTION 'invalid outcome';
  END IF;
  UPDATE public.parent_reminder_deliveries SET status=p_status,
    sent_at=CASE WHEN p_status='sent' THEN pg_catalog.now() ELSE NULL END,
    retry_safe=(p_status='failed' AND p_safe AND phase='prepared' AND p_code='read_failed'),
    phase='complete', lease_until=NULL,error=p_code
  WHERE guardian_id=p_guardian AND reminder_date=p_date AND claim_token=p_token AND status='claimed';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.list_parent_reminder_targets_page(date,uuid,integer),
 public.parent_reminder_pending_qa05(uuid,date),public.claim_parent_reminder_qa05(uuid,date),
 public.begin_parent_reminder_qa05(uuid,date,uuid),public.finish_parent_reminder_qa05(uuid,date,uuid,text,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_parent_reminder_targets_page(date,uuid,integer),
 public.parent_reminder_pending_qa05(uuid,date),public.claim_parent_reminder_qa05(uuid,date),
 public.begin_parent_reminder_qa05(uuid,date,uuid),public.finish_parent_reminder_qa05(uuid,date,uuid,text,boolean,text)
 TO service_role;
COMMIT;
