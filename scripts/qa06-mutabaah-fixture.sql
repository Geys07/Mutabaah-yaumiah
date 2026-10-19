-- LOCAL ONLY: extend the minimal QA fixture, never production.
DO $$ BEGIN IF current_database()<>'qa06_fixture' OR current_setting('port')<>'55436' THEN RAISE EXCEPTION 'LOCAL FIXTURE ONLY'; END IF; END $$;
ALTER TABLE students ADD COLUMN gender text DEFAULT 'female';
UPDATE students SET gender='male' WHERE id='20000000-0000-4000-8000-000000000002';
ALTER TABLE mutabaah_day_submissions ADD COLUMN updated_by uuid, ADD COLUMN updated_at timestamptz, ADD COLUMN finalized_at timestamptz;
CREATE TABLE app_settings(key text PRIMARY KEY,value jsonb);
INSERT INTO app_settings VALUES('mutabaah_haid_quran_exempt','true');
CREATE TABLE mutabaah_activities(id uuid PRIMARY KEY,code text,title text,category text,scoring_mode text,is_active boolean,haid_rule text,allowed_weekdays integer[]);
INSERT INTO mutabaah_activities SELECT ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'prayer-'||i,'CODEX-UJI prayer '||i,'shalat','required',true,'exempt',ARRAY[1,2,3,4,5,6,7] FROM generate_series(1,5)i;
INSERT INTO mutabaah_activities VALUES('50000000-0000-4000-8000-000000000006','quran','CODEX-UJI quran','alquran','required',true,'configurable',ARRAY[1,2,3,4,5,6,7]),('50000000-0000-4000-8000-000000000007','ordinary','CODEX-UJI ordinary','akhlak','required',true,'normal',ARRAY[1,2,3,4,5,6,7]),('50000000-0000-4000-8000-000000000008','ramadan','CODEX-UJI ramadan','ramadan','bonus',true,'normal',ARRAY[1,2,3,4,5,6,7]);
CREATE TABLE mutabaah_ramadan_periods(id uuid PRIMARY KEY,starts_on date,ends_on date,is_enabled boolean);
CREATE TABLE mutabaah_ramadan_activity_links(period_id uuid,activity_id uuid);
INSERT INTO mutabaah_ramadan_periods VALUES('60000000-0000-4000-8000-000000000001',(now() AT TIME ZONE 'Asia/Jakarta')::date-1,(now() AT TIME ZONE 'Asia/Jakarta')::date+1,false);
INSERT INTO mutabaah_ramadan_activity_links VALUES('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000008');
CREATE TABLE mutabaah_day_conditions(student_id uuid,entry_date date,is_haid boolean,updated_by uuid,updated_at timestamptz,PRIMARY KEY(student_id,entry_date));
CREATE TABLE mutabaah_entries(student_id uuid,activity_id uuid,entry_date date,completed boolean,updated_by uuid,updated_at timestamptz,auto_filled boolean,PRIMARY KEY(student_id,activity_id,entry_date));
CREATE TABLE mutabaah_entry_history(id bigserial PRIMARY KEY,student_id uuid,activity_id uuid,entry_date date,old_completed boolean,new_completed boolean,changed_by uuid,changed_at timestamptz,change_type text);
CREATE FUNCTION public.mutabaah_ramadan_date_allowed(p_activity uuid,p_student uuid,p_day date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT CASE WHEN EXISTS (SELECT 1 FROM public.mutabaah_activities a WHERE a.id=p_activity AND a.category='ramadan') THEN
 COALESCE(
  (SELECT bool_or(
    (p.is_enabled AND p_day BETWEEN p.starts_on AND p.ends_on)
    OR EXISTS(SELECT 1 FROM public.mutabaah_entries m WHERE m.student_id=p_student AND m.activity_id=p_activity AND m.entry_date=p_day)
  )
   FROM public.mutabaah_ramadan_activity_links link
   JOIN public.mutabaah_ramadan_periods p ON p.id=link.period_id
   WHERE link.activity_id=p_activity
  ), false)
 ELSE true END;
$fn$;
CREATE OR REPLACE FUNCTION public.get_mutabaah_haid_policy()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_quran boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.account_status='active') then raise exception 'Login diperlukan'; end if;
 select coalesce((select (value #>> '{}')::boolean from public.app_settings where key='mutabaah_haid_quran_exempt'),false) into v_quran;
 return jsonb_build_object('quran_exempt_when_haid',v_quran);
end $function$
;
CREATE OR REPLACE FUNCTION public.get_parent_mutabaah_haid(p_student_id uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_gender text; v_haid boolean; v_quran boolean;
begin
 if auth.uid() is null or not exists(select 1 from public.student_guardians sg join public.profiles p on p.user_id=sg.guardian_id and p.account_status='active' where sg.student_id=p_student_id and sg.guardian_id=auth.uid()) then raise exception 'Akses orang tua ditolak'; end if;
 select lower(coalesce(s.gender,'')) into v_gender from public.students s where s.id=p_student_id;
 if not found then raise exception 'Siswa tidak ditemukan'; end if;
 select coalesce(c.is_haid,false) into v_haid from public.mutabaah_day_conditions c where c.student_id=p_student_id and c.entry_date=p_date;
 select coalesce((select (value #>> '{}')::boolean from public.app_settings where key='mutabaah_haid_quran_exempt'),false) into v_quran;
 return jsonb_build_object('is_female',v_gender in ('female','perempuan','p'),'is_haid',case when v_gender in ('female','perempuan','p') then coalesce(v_haid,false) else false end,'quran_exempt_when_haid',v_quran);
end $function$
;
CREATE OR REPLACE FUNCTION public.log_mutabaah_entry_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.mutabaah_entry_history (
      student_id, activity_id, entry_date,
      old_completed, new_completed, changed_by, changed_at, change_type
    )
    VALUES (
      OLD.student_id, OLD.activity_id, OLD.entry_date,
      OLD.completed, NULL, auth.uid(), now(), 'deleted'
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.completed IS NOT DISTINCT FROM NEW.completed THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mutabaah_entry_history (
    student_id, activity_id, entry_date,
    old_completed, new_completed, changed_by, changed_at, change_type
  )
  VALUES (
    NEW.student_id, NEW.activity_id, NEW.entry_date,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.completed END,
    NEW.completed, COALESCE(auth.uid(), NEW.updated_by), now(),
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mutabaah_cleanup_exempt_answers_on_haid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_changed boolean;
DECLARE v_quran_exempt boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed := NEW.is_haid IS TRUE;
  ELSE
    v_changed := NEW.is_haid IS TRUE AND OLD.is_haid IS DISTINCT FROM TRUE;
  END IF;
  IF NOT v_changed THEN RETURN NEW; END IF;

  SELECT COALESCE(
    (SELECT (v.value #>> '{}')::boolean
     FROM public.app_settings v
     WHERE v.key='mutabaah_haid_quran_exempt'),FALSE)
  INTO v_quran_exempt;

  DELETE FROM public.mutabaah_entries m
  USING public.mutabaah_activities a
  WHERE m.student_id=NEW.student_id
    AND m.entry_date=NEW.entry_date
    AND m.activity_id=a.id
    AND (a.haid_rule='exempt'
         OR (a.haid_rule='configurable' AND v_quran_exempt));
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mutabaah_is_exempt(p_activity uuid, p_student uuid, p_day date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce((
 SELECT
   (NOT (extract(isodow from p_day)::integer = any(a.allowed_weekdays)))
   OR (NOT public.mutabaah_ramadan_date_allowed(p_activity,p_student,p_day))
   OR (
     s.gender in ('female','perempuan','p') AND coalesce(c.is_haid,false)
     AND (a.haid_rule='exempt' OR (a.haid_rule='configurable' AND
      coalesce((SELECT (v.value #>> '{}')::boolean FROM public.app_settings v WHERE v.key='mutabaah_haid_quran_exempt'),false)))
   )
 FROM public.students s CROSS JOIN public.mutabaah_activities a
 LEFT JOIN public.mutabaah_day_conditions c ON c.student_id=s.id AND c.entry_date=p_day
 WHERE s.id=p_student AND a.id=p_activity
 ),false)
$function$
;
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
CREATE TRIGGER mutabaah_entries_audit_change AFTER INSERT OR UPDATE OR DELETE ON mutabaah_entries FOR EACH ROW EXECUTE FUNCTION log_mutabaah_entry_change();
CREATE TRIGGER fixture_haid_cleanup AFTER INSERT OR UPDATE ON mutabaah_day_conditions FOR EACH ROW EXECUTE FUNCTION mutabaah_cleanup_exempt_answers_on_haid();
REVOKE ALL ON FUNCTION submit_parent_mutabaah_day(uuid,date,boolean,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION submit_parent_mutabaah_day(uuid,date,boolean,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_parent_mutabaah_day_state(p_student_id uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_gender text;v_haid boolean;v_quran boolean;v_status text;v_answers jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.student_guardians g join public.profiles p on p.user_id=g.guardian_id and p.account_status='active' where g.student_id=p_student_id and g.guardian_id=auth.uid()) then raise exception 'Akses orang tua ditolak'; end if;
 select lower(coalesce(s.gender,'')) into v_gender from public.students s where s.id=p_student_id;
 if not found then raise exception 'Siswa tidak ditemukan'; end if;
 select c.is_haid into v_haid from public.mutabaah_day_conditions c where c.student_id=p_student_id and c.entry_date=p_date;
 select coalesce((select (v.value #>> '{}')::boolean from public.app_settings v where v.key='mutabaah_haid_quran_exempt'),false) into v_quran;
 select d.status into v_status from public.mutabaah_day_submissions d where d.student_id=p_student_id and d.entry_date=p_date;
 select coalesce(jsonb_agg(jsonb_build_object('activity_id',m.activity_id,'completed',m.completed) order by m.activity_id) filter(where m.activity_id is not null and not m.auto_filled),'[]'::jsonb) into v_answers
 from public.mutabaah_entries m where m.student_id=p_student_id and m.entry_date=p_date;
 return jsonb_build_object('is_female',v_gender in ('female','perempuan','p'),'is_haid',coalesce(v_haid,false),'quran_exempt_when_haid',v_quran,'status',coalesce(v_status,'draft'),'answers',v_answers);
end $function$
;
