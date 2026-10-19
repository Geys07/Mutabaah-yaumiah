-- Remove the pre-filter cap; PostgREST applies filters, exact counts and ranges.
-- Keep the existing signature, masked output and active-Admin authorization.
CREATE OR REPLACE FUNCTION public.list_password_reset_requests()
RETURNS TABLE(id uuid, full_name text, phone_masked text, account_type text, status text, requested_at timestamp with time zone, reviewed_at timestamp with time zone, used_at timestamp with time zone, code_attempts integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
 select r.id,p.full_name,
 case when length(p.phone)>=6 then left(p.phone,4)||repeat('*',greatest(length(p.phone)-6,0))||right(p.phone,2) else '****' end,
 coalesce((select string_agg(ur.role,', ' order by ur.role) from public.user_roles ur where ur.user_id=r.user_id),'pengguna'),
 r.status,r.requested_at,r.reviewed_at,r.used_at,r.code_attempts
 from public.password_reset_requests r join public.profiles p on p.user_id=r.user_id
 where public.has_role('admin') and exists(select 1 from public.profiles a where a.user_id=auth.uid() and a.account_status='active')
 order by case when r.status='pending' then 0 else 1 end, r.requested_at desc, r.id
$function$;
