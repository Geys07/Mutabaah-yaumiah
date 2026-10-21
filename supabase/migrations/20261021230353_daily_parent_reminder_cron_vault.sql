-- Penjadwal pengingat Mutabaah 20.00 WIB.
-- Aktivasi pg_cron dan pg_net tanpa menyalakan pengiriman kepada wali.
-- Cron memakai GMT (UTC); 13:00 GMT = 20:00 Asia/Jakarta (tanpa DST).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Secret dihasilkan DI DATABASE; jangan dimasukkan ke source repository.
do $seed$
begin
  if exists (
    select 1 from public.app_settings
    where key='daily_reminder' and value->>'enabled'='true'
  ) then
    raise exception 'Nonaktifkan pengingat sebelum memasang penjadwal baru';
  end if;

  if not exists (
    select 1 from vault.secrets where name='mutabaah_parent_reminder_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(48), 'hex'),
      'mutabaah_parent_reminder_secret',
      'Hanya untuk autentikasi pg_cron ke parent-reminder-send'
    );
  end if;
end;
$seed$;

-- Autentikasi khusus service_role dari Edge Function; tidak dapat dipanggil
-- oleh user/pengunjung. Nilai Vault tidak pernah dikembalikan.
create or replace function public.verify_parent_reminder_secret(p_candidate text)
returns boolean language plpgsql security definer set search_path = ''
as $fn$
declare
  expected text;
begin
  if p_candidate is null or length(p_candidate) < 32
     or length(p_candidate) > 256 then
    return false;
  end if;
  select decrypted_secret into expected
    from vault.decrypted_secrets
    where name='mutabaah_parent_reminder_secret'
    limit 1;
  return coalesce(
    encode(extensions.digest(expected, 'sha256'), 'hex') =
    encode(extensions.digest(p_candidate, 'sha256'), 'hex'),
    false
  );
end;
$fn$;

revoke all on function public.verify_parent_reminder_secret(text) from public, anon, authenticated;
grant execute on function public.verify_parent_reminder_secret(text) to service_role;

-- Jadwal setiap hari tepat 13:00 GMT/20:00 WIB.
-- Perintah melakukan panggilan HANYA jika status admin ON dan layanan siap.
-- Edge Function juga memeriksa jam lokal, status admin, dan secret; fail closed.
do $schedule$
begin
  if exists (
    select 1 from cron.job
    where jobname = 'mutabaah_parent_reminder_2000_wib'
  ) then
    perform cron.unschedule('mutabaah_parent_reminder_2000_wib');
  end if;
end;
$schedule$;

select cron.schedule(
  'mutabaah_parent_reminder_2000_wib',
  '0 13 * * *',
  $job$
    select net.http_post(
      url := 'https://vxfpwzevatwucvmeszen.supabase.co/functions/v1/parent-reminder-send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-reminder-secret', (
          select decrypted_secret from vault.decrypted_secrets
          where name='mutabaah_parent_reminder_secret'
          limit 1
        )
      ),
      body := '{"dry_run":false,"confirm_send":true}'::jsonb,
      timeout_milliseconds := 120000
    )
    from public.app_settings a
    cross join public.reminder_delivery_readiness r
    where a.key = 'daily_reminder'
      and a.value->>'enabled' = 'true'
      and r.id = true
      and r.transport_ready = true;
  $job$
);

-- Migrasi ini TIDAK pernah mengubah app_settings.enabled atau readiness.
-- Transport dinyatakan siap melalui pemeriksaan health backend sesudah
-- Edge Function yang menggunakan Vault berhasil dipasang dan diuji.
