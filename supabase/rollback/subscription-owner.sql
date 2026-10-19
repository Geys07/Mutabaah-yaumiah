-- Emergency rollback only. Does not delete subscriptions. Reopens cross-role races.
BEGIN;
DROP TRIGGER IF EXISTS postqa06_parent_device_owner ON public.parent_push_subscriptions;
DROP TRIGGER IF EXISTS postqa06_admin_device_owner ON public.admin_push_subscriptions;
-- Retain the non-executable helper for forensic review; no table data is removed.
COMMIT;

-- The selective calendar EXECUTE revocation remains in place on rollback.
-- Its nested definer callers do not require a client grant.
