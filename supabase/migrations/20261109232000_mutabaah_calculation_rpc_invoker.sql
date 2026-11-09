-- The settings table already has an admin-only write policy.
-- Run the activation RPC with caller privileges so RLS remains the final guard.
create or replace function public.start_mutabaah_calculation()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_value jsonb;
begin
  if auth.uid() is null
     or not public.has_role('admin')
     or not exists (
       select 1 from public.profiles p
       where p.user_id = auth.uid() and p.account_status = 'active'
     ) then
    raise exception 'Hanya Admin aktif yang dapat memulai perhitungan';
  end if;

  insert into public.app_settings(key, value, updated_at)
  values (
    'mutabaah_calculation_start',
    jsonb_build_object(
      'started_on', (now() at time zone 'Asia/Jakarta')::date,
      'started_at', now(),
      'started_by', auth.uid()
    ),
    now()
  )
  on conflict (key) do nothing;

  select s.value into v_value
  from public.app_settings s
  where s.key = 'mutabaah_calculation_start';

  return v_value;
end;
$$;

revoke all on function public.start_mutabaah_calculation() from public, anon;
grant execute on function public.start_mutabaah_calculation() to authenticated;
