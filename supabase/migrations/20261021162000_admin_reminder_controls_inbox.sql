-- Kotak masuk pemberitahuan Admin dan kontrol aman pengingat 20.00 WIB.
-- Tidak membuat Cron, tidak mengubah PARENT_REMINDER_ENABLED, tidak mengirim push.
create table if not exists public.admin_notice_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('sample', 'account', 'phone', 'system')),
  title text not null check (char_length(title) between 1 and 150),
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists admin_notice_inbox_owner_created_idx
  on public.admin_notice_inbox (user_id, created_at desc, id desc);
create index if not exists admin_notice_inbox_owner_unread_idx
  on public.admin_notice_inbox (user_id, created_at desc)
  where read_at is null;

alter table public.admin_notice_inbox enable row level security;
revoke all on public.admin_notice_inbox from public, anon;
grant select, update, delete on public.admin_notice_inbox to authenticated;
-- Notifikasi hanya dapat dibuat oleh trigger atau RPC. Admin tak perlu izin INSERT langsung.
drop policy if exists admin_notice_owner_select on public.admin_notice_inbox;
create policy admin_notice_owner_select on public.admin_notice_inbox
 for select to authenticated using (user_id = (select auth.uid()) and (select public.has_role('admin')));
drop policy if exists admin_notice_owner_update on public.admin_notice_inbox;
create policy admin_notice_owner_update on public.admin_notice_inbox
 for update to authenticated using (user_id = (select auth.uid()) and (select public.has_role('admin')))
 with check (user_id = (select auth.uid()) and (select public.has_role('admin')));
drop policy if exists admin_notice_owner_delete on public.admin_notice_inbox;
create policy admin_notice_owner_delete on public.admin_notice_inbox
 for delete to authenticated using (user_id = (select auth.uid()) and (select public.has_role('admin')));

-- Hanya role layanan/backend yang boleh menyatakan cron + kunci push sudah diuji.
create table if not exists public.reminder_delivery_readiness (
  id boolean primary key default true check (id),
  transport_ready boolean not null default false,
  verified_at timestamptz
);
insert into public.reminder_delivery_readiness (id,transport_ready) values (true,false)
 on conflict (id) do nothing;
alter table public.reminder_delivery_readiness enable row level security;
revoke all on public.reminder_delivery_readiness from public, anon, authenticated;

create or replace function public.admin_reminder_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setting jsonb;
  v_enabled boolean := false;
  v_transport boolean := false;
  v_schedule boolean := false;
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Akses khusus admin aktif' using errcode='42501';
  end if;
  select value into v_setting from public.app_settings where key = 'daily_reminder';
  v_enabled := coalesce((v_setting ->> 'enabled')::boolean, false);
  select coalesce(transport_ready,false) into v_transport
    from public.reminder_delivery_readiness where id = true;
  v_transport := coalesce(v_transport,false);
  if to_regclass('cron.job') is not null then
    execute $cron$
      select exists(
        select 1 from cron.job
        where jobname = 'mutabaah_parent_reminder_2000_wib'
          and active = true and schedule = '0 13 * * *'
          and command like '%parent-reminder-send%'
      )
    $cron$ into v_schedule;
  end if;
  return jsonb_build_object(
    'enabled', v_enabled,
    'time', '20:00',
    'timezone', 'Asia/Jakarta',
    'scheduler_ready', v_schedule,
    'delivery_ready', v_transport,
    'can_enable', (v_transport and v_schedule)
  );
end;
$$;

create or replace function public.admin_reminder_set_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status jsonb;
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Akses khusus admin aktif' using errcode='42501';
  end if;
  if p_enabled is null then
    raise exception 'Pilihan status harus diisi' using errcode='22023';
  end if;
  v_status := public.admin_reminder_status();
  if p_enabled and coalesce((v_status->>'can_enable')::boolean,false) = false then
    raise exception 'Pengingat belum siap: penjadwal atau layanan pengiriman belum terverifikasi' using errcode='22023';
  end if;
  insert into public.app_settings (key,value)
    values ('daily_reminder', jsonb_build_object('enabled',p_enabled,'time','20:00','timezone','Asia/Jakarta'))
  on conflict (key) do update set
    value = jsonb_set(
      coalesce(public.app_settings.value,'{}'::jsonb)
        || '{"time":"20:00","timezone":"Asia/Jakarta"}'::jsonb,
      '{enabled}',to_jsonb(p_enabled),true),
    updated_at = now();
  return public.admin_reminder_status();
end;
$$;

create or replace function public.admin_reminder_preview()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
  v_id uuid;
begin
  v_admin := auth.uid();
  if v_admin is null or not public.has_role('admin') then
    raise exception 'Akses khusus admin aktif' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_admin::text), 802000);
  if exists (
    select 1 from public.admin_notice_inbox
    where user_id=v_admin and source='sample'
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'Tunggu 10 detik sebelum mencoba lagi' using errcode='22023';
  end if;
  insert into public.admin_notice_inbox (user_id,source,title,body)
  values (
    v_admin,'sample',
    'Contoh pengingat Mutabaah — MTs Al-Khairiyah',
    'Pengisian Mutabaah ananda hari ini belum selesai. Silakan lengkapi dan finalisasi.'
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.admin_reminder_status() from public, anon;
revoke all on function public.admin_reminder_set_enabled(boolean) from public, anon;
revoke all on function public.admin_reminder_preview() from public, anon;
grant execute on function public.admin_reminder_status() to authenticated;
grant execute on function public.admin_reminder_set_enabled(boolean) to authenticated;
grant execute on function public.admin_reminder_preview() to authenticated;

-- Event permintaan baru tetap tersimpan sebagai permintaan; menghapus item inbox
-- tidak menghapus, menyetujui, maupun menolak permintaan aslinya.
create or replace function public.admin_notice_new_account_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'pending' then
    insert into public.admin_notice_inbox(user_id,source,title,body)
    select ur.user_id,'account','Permintaan pemulihan akun',
      'Ada permintaan pemulihan kata sandi baru. Periksa menu Permintaan Akun.'
    from public.user_roles ur
    join public.profiles pr on pr.user_id=ur.user_id
    where ur.role='admin' and pr.account_status='active';
  end if;
  return new;
end;
$$;
drop trigger if exists admin_notice_account_request_created on public.password_reset_requests;
create trigger admin_notice_account_request_created
  after insert on public.password_reset_requests
  for each row execute function public.admin_notice_new_account_request();

create or replace function public.admin_notice_new_phone_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'pending' then
    insert into public.admin_notice_inbox(user_id,source,title,body)
    select ur.user_id,'phone','Permintaan perubahan nomor HP',
      'Ada permintaan perubahan nomor HP wali murid. Periksa menu Perubahan Nomor.'
    from public.user_roles ur
    join public.profiles pr on pr.user_id=ur.user_id
    where ur.role='admin' and pr.account_status='active';
  end if;
  return new;
end;
$$;
drop trigger if exists admin_notice_phone_request_created on public.parent_phone_change_requests;
create trigger admin_notice_phone_request_created
  after insert on public.parent_phone_change_requests
  for each row execute function public.admin_notice_new_phone_request();

-- Fail closed: konfigurasi aktual tidak diaktifkan oleh migrasi ini.
