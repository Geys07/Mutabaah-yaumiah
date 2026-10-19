-- Emergency rollback to latest production definitions, not the old QA06 baseline.
BEGIN;
CREATE OR REPLACE FUNCTION public.submit_parent_mutabaah_day(p_student_id uuid, p_date date, p_is_haid boolean, p_answers jsonb, p_finalize boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_gender text;v_today date;v_uid uuid;v_row jsonb;v_activity uuid;v_completed boolean;v_count integer;v_n integer;v_ids uuid[]:=array[]::uuid[];v_finalized integer:=0;
begin
 v_uid:=auth.uid();
 if v_uid is null or not exists(select 1 from public.student_guardians g join public.profiles p on p.user_id=g.guardian_id and p.account_status='active' where g.student_id=p_student_id and g.guardian_id=v_uid) then raise exception 'Akses orang tua ditolak'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 if p_date is null or p_date>v_today or p_date<v_today-29 then raise exception 'Tanggal hanya diperbolehkan dalam 30 hari terakhir'; end if;
 if not exists (
  select 1 from public.student_enrollments e
  join public.classes c on c.id=e.class_id
  join public.academic_years y on y.id=c.academic_year_id
  where e.student_id=p_student_id and e.starts_on<=p_date
    and (e.ends_on is null or e.ends_on>=p_date)
    and y.starts_on<=p_date and y.ends_on>=p_date
 ) then raise exception 'Tanggal di luar penempatan akademik siswa'; end if;
 if p_finalize is null then raise exception 'Mode penyimpanan tidak valid'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Format jawaban tidak valid'; end if;
 v_n:=jsonb_array_length(p_answers);
 if v_n>100 then raise exception 'Terlalu banyak jawaban'; end if;
 select lower(coalesce(s.gender,'')) into v_gender from public.students s where s.id=p_student_id;
 if not found then raise exception 'Siswa tidak ditemukan'; end if;
 if v_gender in ('female','perempuan','p') then
  if p_is_haid is null then raise exception 'Status haid belum dipilih'; end if;
 elsif p_is_haid is true then raise exception 'Pilihan haid hanya untuk siswi';
 end if;
 insert into public.mutabaah_day_submissions(student_id,entry_date,status,updated_by)
 values(p_student_id,p_date,'draft',v_uid)
 on conflict(student_id,entry_date) do nothing;
 perform 1 from public.mutabaah_day_submissions where student_id=p_student_id and entry_date=p_date for update;
 if v_gender in ('female','perempuan','p') then
  insert into public.mutabaah_day_conditions(student_id,entry_date,is_haid,updated_by,updated_at)
  values(p_student_id,p_date,p_is_haid,v_uid,now())
  on conflict(student_id,entry_date) do update set is_haid=excluded.is_haid,updated_by=v_uid,updated_at=now();
 end if;
 for v_count in 0..v_n-1 loop
  v_row:=p_answers->v_count;
  if jsonb_typeof(v_row) is distinct from 'object' then raise exception 'Jawaban tidak valid'; end if;
  if coalesce(v_row->>'activity_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'ID kegiatan tidak valid'; end if;
  v_activity:=(v_row->>'activity_id')::uuid;
  if v_activity=any(v_ids) then raise exception 'Kegiatan duplikat'; end if;
  v_ids:=pg_catalog.array_append(v_ids,v_activity);
  if not exists(select 1 from public.mutabaah_activities a where a.id=v_activity and a.is_active) then raise exception 'Kegiatan tidak aktif'; end if;
  if public.mutabaah_is_exempt(v_activity,p_student_id,p_date) then raise exception 'Kegiatan dikecualikan'; end if;
  if jsonb_typeof(v_row->'completed') is distinct from 'boolean' then raise exception 'Jawaban hanya Ya atau Tidak'; end if;
  v_completed:=(v_row->>'completed')::boolean;
  insert into public.mutabaah_entries(student_id,activity_id,entry_date,completed,updated_by,updated_at,auto_filled)
  values(p_student_id,v_activity,p_date,v_completed,v_uid,now(),false)
  on conflict(student_id,activity_id,entry_date) do update set completed=excluded.completed,updated_by=v_uid,updated_at=now(),auto_filled=false;
 end loop;
 delete from public.mutabaah_entries m where m.student_id=p_student_id and m.entry_date=p_date and m.activity_id<>all(v_ids)
 and exists(select 1 from public.mutabaah_activities a where a.id=m.activity_id and a.is_active and NOT public.mutabaah_is_exempt(a.id,p_student_id,p_date)
 AND (a.category <> 'ramadan' OR exists(
 SELECT 1 FROM public.mutabaah_ramadan_activity_links link
 JOIN public.mutabaah_ramadan_periods p ON p.id=link.period_id
 WHERE link.activity_id=a.id AND p.is_enabled AND p_date BETWEEN p.starts_on AND p.ends_on
 )));
 if p_finalize then
  insert into public.mutabaah_entries(student_id,activity_id,entry_date,completed,updated_by,updated_at,auto_filled)
  select p_student_id,a.id,p_date,false,v_uid,now(),true
  from public.mutabaah_activities a where a.is_active and not public.mutabaah_is_exempt(a.id,p_student_id,p_date)
  on conflict(student_id,activity_id,entry_date) do nothing;
  get diagnostics v_finalized=row_count;
 end if;
 update public.mutabaah_day_submissions set status=case when p_finalize then 'finalized' else 'draft' end,
 updated_by=v_uid,updated_at=now(),finalized_at=case when p_finalize then now() else null end
 where student_id=p_student_id and entry_date=p_date;
 return jsonb_build_object('success',true,'status',case when p_finalize then 'finalized' else 'draft' end,'auto_filled',v_finalized);
end $function$
;
CREATE OR REPLACE FUNCTION public.save_parent_mutabaah_day(p_student_id uuid, p_date date, p_is_haid boolean, p_answers jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_gender text;v_today date;v_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.student_guardians sg join public.profiles p on p.user_id=sg.guardian_id where sg.student_id=p_student_id and sg.guardian_id=auth.uid() and p.account_status='active') then raise exception 'Akses orang tua ditolak'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 if p_date is null or p_date>v_today or p_date<v_today-29 then raise exception 'Pengisian hanya untuk 30 hari terakhir'; end if;
 if not exists (
  select 1 from public.student_enrollments e
  join public.classes c on c.id=e.class_id
  join public.academic_years y on y.id=c.academic_year_id
  where e.student_id=p_student_id and e.starts_on<=p_date
    and (e.ends_on is null or e.ends_on>=p_date)
    and y.starts_on<=p_date and y.ends_on>=p_date
 ) then raise exception 'Tanggal di luar penempatan akademik siswa'; end if;
 select lower(coalesce(s.gender,'')) into v_gender from public.students s where s.id=p_student_id;
 if not found then raise exception 'Siswa tidak ditemukan'; end if;
 if v_gender in ('female','perempuan','p') then
  if p_is_haid is null then raise exception 'Pilih status haid terlebih dahulu'; end if;
  insert into public.mutabaah_day_conditions(student_id,entry_date,is_haid,updated_by,updated_at)
  values(p_student_id,p_date,p_is_haid,auth.uid(),now())
  on conflict(student_id,entry_date) do update set is_haid=excluded.is_haid,updated_by=excluded.updated_by,updated_at=now();
 elsif p_is_haid is true then raise exception 'Pilihan haid hanya untuk siswi';
 end if;
 v_count:=public.save_mutabaah_day(p_student_id,p_date,p_answers);
 return v_count;
end $function$
;
CREATE OR REPLACE FUNCTION public.save_mutabaah_day(p_student_id uuid, p_date date, p_answers jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid; v_row jsonb; v_activity uuid; v_completed boolean; v_count integer; v_total integer; v_seen uuid[]:=array[]::uuid[]; v_today date;
begin
 v_uid:=auth.uid();
 if v_uid is null then raise exception 'Login diperlukan'; end if;
 if not (public.has_role('admin') or exists(select 1 from public.student_guardians sg join public.profiles p on p.user_id=sg.guardian_id where sg.student_id=p_student_id and sg.guardian_id=v_uid and p.account_status='active')) then raise exception 'Akses ditolak'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 if p_date is null or p_date>v_today or p_date<v_today-29 then raise exception 'Pengisian hanya untuk 30 hari terakhir'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Format jawaban tidak valid'; end if;
 v_total:=jsonb_array_length(p_answers);
 if v_total>100 then raise exception 'Terlalu banyak jawaban'; end if;
 for v_count in 0..v_total-1 loop
  v_row:=p_answers->v_count;
  if jsonb_typeof(v_row) is distinct from 'object' then raise exception 'Jawaban tidak valid'; end if;
  v_activity:=(v_row->>'activity_id')::uuid;
  if v_activity=any(v_seen) then raise exception 'Kegiatan berulang'; end if;
  v_seen:=pg_catalog.array_append(v_seen,v_activity);
  if not exists(select 1 from public.mutabaah_activities where id=v_activity and is_active) then raise exception 'Kegiatan tidak tersedia'; end if;
  if jsonb_typeof(v_row->'completed') is distinct from 'boolean' then raise exception 'Jawaban harus Ya atau Tidak'; end if;
  if public.mutabaah_is_exempt(v_activity,p_student_id,p_date) then raise exception 'Kegiatan ini dikecualikan dan tidak perlu diisi'; end if;
  v_completed:=(v_row->>'completed')::boolean;
  insert into public.mutabaah_entries(student_id,activity_id,entry_date,completed,updated_by,updated_at)
  values(p_student_id,v_activity,p_date,v_completed,v_uid,now())
  on conflict(student_id,activity_id,entry_date) do update
  set completed=excluded.completed,updated_by=excluded.updated_by,updated_at=now();
 end loop;
 return v_total;
end $function$
;
CREATE OR REPLACE FUNCTION public.set_parent_mutabaah_haid(p_student_id uuid, p_date date, p_is_haid boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_gender text; v_today date;
begin
 if auth.uid() is null or not exists(select 1 from public.student_guardians sg join public.profiles p on p.user_id=sg.guardian_id and p.account_status='active' where sg.student_id=p_student_id and sg.guardian_id=auth.uid()) then raise exception 'Akses orang tua ditolak'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 if p_date is null or p_date>v_today or p_date<v_today-29 then raise exception 'Pengisian hanya untuk 30 hari terakhir'; end if;
 if p_is_haid is null then raise exception 'Status wajib dipilih'; end if;
 select lower(coalesce(s.gender,'')) into v_gender from public.students s where s.id=p_student_id;
 if not found then raise exception 'Siswa tidak ditemukan'; end if;
 if v_gender not in ('female','perempuan','p') then raise exception 'Pilihan ini hanya tersedia untuk siswi'; end if;
 insert into public.mutabaah_day_conditions(student_id,entry_date,is_haid,updated_by,updated_at)
 values(p_student_id,p_date,p_is_haid,auth.uid(),now())
 on conflict(student_id,entry_date) do update
 set is_haid=excluded.is_haid,updated_by=excluded.updated_by,updated_at=now();
 return true;
end $function$
;
COMMIT;
