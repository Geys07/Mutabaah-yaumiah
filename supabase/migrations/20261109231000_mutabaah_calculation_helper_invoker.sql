-- The date helper only reads a staff-visible setting; it does not need elevated privileges.
create or replace function public.mutabaah_calculation_start_date()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(s.value->>'started_on', '')::date
  from public.app_settings s
  where s.key = 'mutabaah_calculation_start'
$$;

revoke all on function public.mutabaah_calculation_start_date() from public, anon;
grant execute on function public.mutabaah_calculation_start_date() to authenticated;
