-- Global device ownership across parent/admin tables; no existing rows modified.
BEGIN;
LOCK TABLE public.parent_push_subscriptions,public.admin_push_subscriptions IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$ BEGIN
 IF EXISTS(SELECT 1 FROM public.parent_push_subscriptions p JOIN public.admin_push_subscriptions a ON a.endpoint=p.endpoint WHERE a.user_id<>p.guardian_id) THEN RAISE EXCEPTION 'Existing endpoint owner conflicts require review'; END IF;
 IF to_regprocedure('public.enforce_push_subscription_owner_qa06()') IS NOT NULL AND (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.enforce_push_subscription_owner_qa06()')) IS DISTINCT FROM '8abb2777b5840ec75496fae071562ebd' THEN RAISE EXCEPTION 'Subscription guard baseline changed'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.enforce_push_subscription_owner_qa06()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_owner uuid; v_role text;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' THEN RAISE EXCEPTION 'Unsupported subscription table'; END IF;
 IF TG_TABLE_NAME='parent_push_subscriptions' THEN
  v_owner:=NEW.guardian_id;v_role:='parent';
 ELSIF TG_TABLE_NAME='admin_push_subscriptions' THEN
  v_owner:=NEW.user_id;v_role:='admin';
 ELSE RAISE EXCEPTION 'Unsupported subscription table'; END IF;
 IF v_owner IS NULL OR NEW.endpoint IS NULL THEN RAISE EXCEPTION 'Invalid subscription' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.user_id
  WHERE p.user_id=v_owner AND p.account_status='active' AND r.role=v_role)
 THEN RAISE EXCEPTION 'Active subscription role required' USING ERRCODE='42501'; END IF;
 -- Both tables share this transaction lock. A pre-check outside the transaction
 -- cannot prevent two different accounts winning simultaneous registrations.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.endpoint,0));
 IF EXISTS(SELECT 1 FROM public.parent_push_subscriptions p WHERE p.endpoint=NEW.endpoint AND p.guardian_id<>v_owner)
 OR EXISTS(SELECT 1 FROM public.admin_push_subscriptions a WHERE a.endpoint=NEW.endpoint AND a.user_id<>v_owner)
 THEN RAISE EXCEPTION 'Subscription belongs to another account' USING ERRCODE='23505'; END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.enforce_push_subscription_owner_qa06() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS postqa06_parent_device_owner ON public.parent_push_subscriptions;
CREATE TRIGGER postqa06_parent_device_owner BEFORE INSERT OR UPDATE OF endpoint,guardian_id
 ON public.parent_push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.enforce_push_subscription_owner_qa06();
DROP TRIGGER IF EXISTS postqa06_admin_device_owner ON public.admin_push_subscriptions;
CREATE TRIGGER postqa06_admin_device_owner BEFORE INSERT OR UPDATE OF endpoint,user_id
 ON public.admin_push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.enforce_push_subscription_owner_qa06();
-- This helper reads answer existence. All callers are owner-run definer functions;
-- no UI or RLS policy calls it directly. Preserve internal use, remove client oracle.
REVOKE EXECUTE ON FUNCTION public.mutabaah_ramadan_date_allowed(uuid,uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutabaah_ramadan_date_allowed(uuid,uuid,date) TO service_role;
COMMIT;
