-- PROPOSAL ONLY: do not execute until review. Never activates sending.
-- Prerequisites: approved functions/SQL, pg_cron + pg_net, Vault entries.
-- Check current_setting('cron.timezone',true) first, NOT just SHOW timezone.
DO $$
DECLARE v_job bigint; v_zone text := pg_catalog.current_setting('cron.timezone',true);
BEGIN
 IF v_zone IS DISTINCT FROM 'GMT' AND v_zone IS DISTINCT FROM 'UTC' THEN
  RAISE EXCEPTION 'Expected verified UTC/GMT cron.timezone; review schedule';
 END IF;
 IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='mutabaah-parent-reminder-qa05'
   OR command ILIKE '%parent-reminder-send%') THEN
  RAISE EXCEPTION 'Existing reminder job: inspect, do not create a duplicate';
 END IF;
 IF (SELECT count(*) FROM vault.secrets WHERE name='qa05_project_url')<>1
 OR (SELECT count(*) FROM vault.secrets WHERE name='qa05_parent_reminder_secret')<>1 THEN
  RAISE EXCEPTION 'Vault names must each exist exactly once';
 END IF;
 -- First invocation 20:00 WIB; recovery ticks only until 20:14 in ONE job.
 v_job := cron.schedule('mutabaah-parent-reminder-qa05','0-14/2 13 * * *', $job$
  SELECT net.http_post(
   url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='qa05_project_url') || '/functions/v1/parent-reminder-send',
   headers := pg_catalog.jsonb_build_object('Content-Type','application/json',
     'x-reminder-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='qa05_parent_reminder_secret')),
   body := '{"dry_run":true}'::jsonb, timeout_milliseconds := 110000
  );
 $job$);
 -- Same transaction: no committed active job exists, even briefly.
 PERFORM cron.alter_job(v_job,active:=false);
END;
$$;
