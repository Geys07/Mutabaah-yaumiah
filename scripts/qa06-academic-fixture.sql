-- LOCAL FIXTURE ONLY; exact functions except explicit lifecycle/promotion clock injection.
DO $$ BEGIN IF current_database()<>'qa06_fixture' OR current_setting('port')<>'55436' THEN RAISE EXCEPTION 'LOCAL FIXTURE ONLY'; END IF; END $$;
CREATE FUNCTION public.qa06_clock() RETURNS timestamptz LANGUAGE sql STABLE AS $$SELECT coalesce(nullif(current_setting('qa06.clock',true),''),'2026-10-18T12:00:00Z')::timestamptz$$;
ALTER TABLE academic_years ADD COLUMN start_year integer UNIQUE;
UPDATE academic_years SET start_year=2026;
INSERT INTO academic_years VALUES('40000000-0000-4000-8000-000000000002','2027-07-01','2028-06-30',2027);
ALTER TABLE classes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE classes ADD COLUMN grade integer, ADD COLUMN name text, ADD UNIQUE(academic_year_id,name);
UPDATE classes SET grade=CASE WHEN right(id::text,1)='1' THEN 7 ELSE 9 END,name=CASE WHEN right(id::text,1)='1' THEN 'VII A' ELSE 'IX A' END;
INSERT INTO classes(id,academic_year_id,grade,name) VALUES('30000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001',8,'VIII A');
ALTER TABLE students ADD COLUMN exited_on date;
ALTER TABLE student_enrollments ALTER COLUMN id SET DEFAULT gen_random_uuid();
INSERT INTO students(id,status,gender) VALUES('20000000-0000-4000-8000-000000000004','active','female');
INSERT INTO student_enrollments(student_id,class_id,starts_on) VALUES('20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003','2026-07-01');
CREATE TABLE mutabaah_promotion_runs(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,source_year_id uuid UNIQUE,target_year_id uuid UNIQUE,confirmed_by uuid,moved_count integer,graduated_count integer);
CREATE TABLE semesters(id uuid PRIMARY KEY,academic_year_id uuid,starts_on date,ends_on date,term integer);
INSERT INTO semesters VALUES('70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-07-01','2026-12-31',1),('70000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','2027-01-01','2027-06-30',2);
CREATE SCHEMA storage;
CREATE TABLE storage.objects(bucket_id text,name text,owner_id text);
CREATE TABLE mutabaah_report_archives(id uuid PRIMARY KEY,class_id uuid,semester_id uuid,created_by uuid,storage_path text,file_name text,student_count integer,issued_on date,content_fingerprint text,UNIQUE(class_id,semester_id,content_fingerprint));
CREATE OR REPLACE FUNCTION public.admin_change_student_lifecycle(p_student_id uuid, p_action text, p_target_class_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_student public.students%ROWTYPE;
 v_enrollment public.student_enrollments%ROWTYPE;
 v_today date := (public.qa06_clock() AT TIME ZONE 'Asia/Jakarta')::date;
 v_year public.academic_years%ROWTYPE;
 v_class public.classes%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN
  RAISE EXCEPTION 'Hanya admin yang dapat mengubah status siswa';
 END IF;
 IF p_action NOT IN ('exit','return') OR p_student_id IS NULL THEN
  RAISE EXCEPTION 'Permintaan status tidak valid';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student_id::text,0));
 SELECT * INTO v_student FROM public.students WHERE id=p_student_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Siswa tidak ditemukan'; END IF;
 IF p_action='exit' THEN
  IF v_student.status <> 'active' THEN
   RAISE EXCEPTION 'Hanya siswa aktif yang dapat dinyatakan keluar';
  END IF;
  SELECT e.* INTO v_enrollment
   FROM public.student_enrollments e
   JOIN public.classes c ON c.id=e.class_id
   JOIN public.academic_years y ON y.id=c.academic_year_id
   WHERE e.student_id=p_student_id AND e.ends_on IS NULL
     AND v_today BETWEEN y.starts_on AND y.ends_on
   ORDER BY e.starts_on DESC LIMIT 1 FOR UPDATE OF e;
  IF NOT FOUND THEN
   RAISE EXCEPTION 'Keanggotaan kelas aktif pada tahun ajaran berjalan tidak ditemukan';
  END IF;
  IF v_enrollment.starts_on>v_today THEN
   RAISE EXCEPTION 'Tanggal mulai kelas siswa berada di masa depan';
  END IF;
  IF EXISTS (
   SELECT 1 FROM public.student_enrollments e
   WHERE e.student_id=p_student_id AND e.ends_on IS NULL AND e.id<>v_enrollment.id
  ) THEN RAISE EXCEPTION 'Siswa memiliki lebih dari satu kelas aktif'; END IF;
  UPDATE public.student_enrollments SET ends_on=v_today WHERE id=v_enrollment.id;
  UPDATE public.students SET status='exited',exited_on=v_today WHERE id=p_student_id;
  RETURN jsonb_build_object('success',true,'action','exit','student_id',p_student_id);
 END IF;
 IF v_student.status <> 'exited' THEN
  RAISE EXCEPTION 'Hanya siswa berstatus keluar yang dapat diaktifkan kembali';
 END IF;
 IF p_target_class_id IS NULL THEN RAISE EXCEPTION 'Pilih kelas tujuan';END IF;
 SELECT * INTO v_class FROM public.classes WHERE id=p_target_class_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kelas tujuan tidak tersedia'; END IF;
 SELECT * INTO v_year FROM public.academic_years WHERE id=v_class.academic_year_id;
 IF NOT v_today BETWEEN v_year.starts_on AND v_year.ends_on THEN
  RAISE EXCEPTION 'Kelas tujuan harus berada pada tahun ajaran yang berjalan';
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.student_enrollments e
   WHERE e.student_id=p_student_id
    AND (e.ends_on IS NULL OR e.ends_on>=v_today)
 ) THEN
  RAISE EXCEPTION 'Riwayat kelas siswa masih aktif atau bertabrakan pada tanggal ini';
 END IF;
 INSERT INTO public.student_enrollments(student_id,class_id,starts_on,ends_on)
 VALUES(p_student_id,p_target_class_id,v_today,NULL);
 UPDATE public.students SET status='active',exited_on=NULL WHERE id=p_student_id;
 RETURN jsonb_build_object('success',true,'action','return','student_id',p_student_id,
  'class_id',p_target_class_id);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.confirm_mutabaah_promotion(p_source_year integer, p_assignments jsonb, p_expected_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_source public.academic_years%ROWTYPE;
        v_target public.academic_years%ROWTYPE;
        v_count integer;v_move_count integer;v_graduate_count integer;
        v_accepted integer;v_row record;
        v_now date:=(public.qa06_clock() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN
   RAISE EXCEPTION 'Hanya admin yang dapat mengonfirmasi kenaikan kelas';
 END IF;
 IF p_assignments IS NULL OR jsonb_typeof(p_assignments)<>'array'
    OR jsonb_array_length(p_assignments)>5000 THEN
   RAISE EXCEPTION 'Daftar tujuan siswa tidak valid';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mutabaah-promotion-'||p_source_year::text,0));
 SELECT * INTO v_source FROM public.academic_years WHERE start_year=p_source_year;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tahun ajaran sumber tidak ditemukan'; END IF;
 SELECT * INTO v_target FROM public.academic_years WHERE start_year=p_source_year+1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Buat tahun ajaran berikutnya terlebih dahulu'; END IF;
 IF v_now<v_target.starts_on THEN RAISE EXCEPTION 'Kenaikan kelas baru dapat dikonfirmasi mulai %',v_target.starts_on;END IF;
 IF v_target.starts_on<>v_source.ends_on+1 THEN
   RAISE EXCEPTION 'Tanggal pergantian tahun ajaran harus berurutan';
 END IF;
 IF EXISTS (SELECT 1 FROM public.mutabaah_promotion_runs WHERE source_year_id=v_source.id OR target_year_id=v_target.id) THEN
   RAISE EXCEPTION 'Kenaikan kelas tahun ini sudah dikonfirmasi';
 END IF;

 PERFORM 1 FROM public.student_enrollments e
 JOIN public.classes c ON c.id=e.class_id
 WHERE c.academic_year_id=v_source.id AND e.ends_on IS NULL
 FOR UPDATE OF e;
 PERFORM 1 FROM public.students s WHERE s.id IN (
  SELECT e.student_id FROM public.student_enrollments e
  JOIN public.classes c ON c.id=e.class_id
  WHERE c.academic_year_id=v_source.id AND e.ends_on IS NULL
 ) FOR UPDATE OF s;

 SELECT count(*) INTO v_count
 FROM public.student_enrollments e JOIN public.classes c ON c.id=e.class_id
 JOIN public.students s ON s.id=e.student_id
 WHERE c.academic_year_id=v_source.id AND e.ends_on IS NULL AND s.status='active';
 IF v_count<>p_expected_count OR v_count=0 THEN
   RAISE EXCEPTION 'Data siswa telah berubah. Muat ulang pratinjau sebelum mengonfirmasi';
 END IF;
 IF EXISTS(
  SELECT e.student_id FROM public.student_enrollments e
  JOIN public.classes c ON c.id=e.class_id
  JOIN public.students s ON s.id=e.student_id
  WHERE c.academic_year_id=v_source.id AND e.ends_on IS NULL AND s.status='active'
  GROUP BY e.student_id HAVING count(*)<>1
 ) THEN RAISE EXCEPTION 'Ada siswa dengan lebih dari satu kelas aktif; periksa Data Siswa'; END IF;
 IF EXISTS(
  SELECT 1 FROM public.student_enrollments e
  JOIN public.classes c ON c.id=e.class_id
  JOIN public.students s ON s.id=e.student_id
  WHERE c.academic_year_id=v_source.id AND e.ends_on IS NULL AND s.status='active'
    AND (e.starts_on>v_source.ends_on OR EXISTS(
       SELECT 1 FROM public.student_enrollments future
       JOIN public.classes fc ON fc.id=future.class_id
       WHERE future.student_id=e.student_id AND fc.academic_year_id=v_target.id))
 ) THEN RAISE EXCEPTION 'Ada siswa dengan tanggal keanggotaan atau kelas tahun depan yang bertabrakan'; END IF;

 SELECT count(*) INTO v_move_count FROM public.student_enrollments e
 JOIN public.classes c ON c.id=e.class_id JOIN public.students s ON s.id=e.student_id
 WHERE c.academic_year_id=v_source.id AND e.ends_on IS NULL AND s.status='active' AND c.grade<9;
 SELECT count(*) INTO v_graduate_count FROM public.student_enrollments e
 JOIN public.classes c ON c.id=e.class_id JOIN public.students s ON s.id=e.student_id
 WHERE c.academic_year_id=v_source.id AND e.ends_on IS NULL AND s.status='active' AND c.grade=9;
 IF jsonb_array_length(p_assignments)<>v_count THEN
   RAISE EXCEPTION 'Daftar pembagian kelas tidak lengkap';
 END IF;

 WITH assignments AS (
   SELECT x.enrollment_id,x.destination
   FROM jsonb_to_recordset(p_assignments) AS x(enrollment_id uuid,destination text)
 )
 SELECT count(*) INTO v_accepted FROM assignments a
 JOIN public.student_enrollments e ON e.id=a.enrollment_id AND e.ends_on IS NULL
 JOIN public.classes c ON c.id=e.class_id AND c.academic_year_id=v_source.id
 JOIN public.students s ON s.id=e.student_id AND s.status='active'
 WHERE (c.grade=7 AND a.destination IN ('VIII A','VIII B'))
    OR (c.grade=8 AND a.destination IN ('IX A','IX B')) OR (c.grade=9 AND a.destination='LULUS');
 IF v_accepted<>v_count OR EXISTS(
   SELECT 1 FROM jsonb_to_recordset(p_assignments) AS x(enrollment_id uuid,destination text)
   GROUP BY x.enrollment_id HAVING count(*)<>1
 ) THEN RAISE EXCEPTION 'Ada tujuan kelas yang tidak valid atau siswa duplikat'; END IF;

 INSERT INTO public.mutabaah_promotion_runs(
  source_year_id,target_year_id,confirmed_by,moved_count,graduated_count)
 VALUES (v_source.id,v_target.id,auth.uid(),v_move_count,v_graduate_count);

 FOR v_row IN SELECT DISTINCT destination
  FROM jsonb_to_recordset(p_assignments) AS x(enrollment_id uuid,destination text)
  WHERE destination<>'LULUS'
 LOOP
   INSERT INTO public.classes(academic_year_id,grade,name)
   VALUES(v_target.id,CASE WHEN v_row.destination LIKE 'VIII%' THEN 8 ELSE 9 END,v_row.destination)
   ON CONFLICT(academic_year_id,name) DO NOTHING;
 END LOOP;

 UPDATE public.student_enrollments e SET ends_on=v_source.ends_on
 FROM public.classes c, public.students s
 WHERE c.id=e.class_id AND c.academic_year_id=v_source.id
   AND s.id=e.student_id AND s.status='active' AND e.ends_on IS NULL;

 INSERT INTO public.student_enrollments(student_id,class_id,starts_on,ends_on)
 SELECT e.student_id,dest.id,v_target.starts_on,NULL
 FROM jsonb_to_recordset(p_assignments) AS x(enrollment_id uuid,destination text)
 JOIN public.student_enrollments e ON e.id=x.enrollment_id
 JOIN public.classes dest ON dest.academic_year_id=v_target.id AND dest.name=x.destination;

 UPDATE public.students s SET status='graduated',exited_on=v_source.ends_on
 WHERE s.status='active' AND EXISTS(
  SELECT 1 FROM public.student_enrollments e JOIN public.classes c ON c.id=e.class_id
  WHERE e.student_id=s.id AND c.academic_year_id=v_source.id AND c.grade=9
    AND e.ends_on=v_source.ends_on
 );
 RETURN jsonb_build_object('success',true,'moved',v_move_count,'graduated',v_graduate_count,
 'source_year',p_source_year,'target_year',p_source_year+1);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.mutabaah_can_write_report_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select (select auth.uid()) is not null
and (
public.has_role('admin')
or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=(select auth.uid()))
);
$function$
;
CREATE OR REPLACE FUNCTION public.protect_mutabaah_semester_dates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_year public.academic_years%ROWTYPE;
BEGIN
 IF OLD.starts_on=NEW.starts_on AND OLD.ends_on=NEW.ends_on
   AND OLD.academic_year_id=NEW.academic_year_id AND OLD.term=NEW.term THEN
  RETURN NEW;
 END IF;
 IF EXISTS(SELECT 1 FROM public.mutabaah_report_archives a
   JOIN public.semesters s ON s.id=a.semester_id
   WHERE s.academic_year_id=OLD.academic_year_id) THEN
  RAISE EXCEPTION 'Tanggal semester tidak dapat diubah setelah ada rapor yang diterbitkan';
 END IF;
 SELECT * INTO v_year FROM public.academic_years WHERE id=NEW.academic_year_id;
 IF NOT FOUND OR NEW.starts_on<v_year.starts_on OR NEW.ends_on>v_year.ends_on THEN
  RAISE EXCEPTION 'Tanggal semester harus berada dalam tahun ajaran';
 END IF;
 IF EXISTS(
   SELECT 1 FROM public.semesters s
   WHERE s.academic_year_id=NEW.academic_year_id AND s.id<>OLD.id
   AND s.starts_on<=NEW.ends_on AND s.ends_on>=NEW.starts_on
 ) THEN
  RAISE EXCEPTION 'Tanggal semester saling bertumpang tindih';
 END IF;
 RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.register_mutabaah_report_archive_v2(p_archive_id uuid, p_class_id uuid, p_semester_id uuid, p_file_name text, p_student_count integer, p_issued_on date, p_content_fingerprint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_path text;
 v_end date;
 v_stored_id uuid;
begin
 if not public.mutabaah_can_write_report_class(p_class_id) then
   raise exception 'Tidak diizinkan menyimpan arsip kelas ini';
 end if;
 if p_archive_id is null or p_semester_id is null or p_issued_on is null
     or p_student_count is null or p_student_count not between 1 and 500 then
   raise exception 'Parameter arsip tidak lengkap';
 end if;
 if p_content_fingerprint is null
      or p_content_fingerprint !~ '^[a-f0-9]{64}$' then
   raise exception 'Sidik isi rapor tidak valid';
 end if;
 select s.ends_on into v_end
   from public.classes c
   join public.semesters s on s.academic_year_id=c.academic_year_id
  where c.id=p_class_id and s.id=p_semester_id;
 if v_end is null then
   raise exception 'Semester tidak sesuai kelas';
 end if;
 if p_issued_on>v_end or p_issued_on>(now() at time zone 'Asia/Jakarta')::date then
   raise exception 'Tanggal pengesahan tidak valid';
 end if;
 if p_file_name is null or length(p_file_name)>200 or right(lower(p_file_name),5)<>'.docx' then
   raise exception 'Nama dokumen tidak valid';
 end if;

 -- Secondary check prevents duplicates even if two clients upload concurrently.
 select a.id into v_stored_id
   from public.mutabaah_report_archives a
  where a.class_id=p_class_id
    and a.semester_id=p_semester_id
    and a.content_fingerprint=p_content_fingerprint
  limit 1;
 if v_stored_id is not null then
   return jsonb_build_object('created',false,'id',v_stored_id);
 end if;

 v_path:=p_class_id::text||'/'||p_semester_id::text||'/'||p_archive_id::text||'.docx';
 if not exists (
  select 1 from storage.objects o
   where o.bucket_id='mutabaah-report-archives' and o.name=v_path
      and o.owner_id=(select auth.uid())::text
 ) then
   raise exception 'File DOCX arsip belum diunggah oleh akun Anda';
 end if;

 insert into public.mutabaah_report_archives
 (id,class_id,semester_id,created_by,storage_path,file_name,student_count,issued_on,content_fingerprint)
 values
 (p_archive_id,p_class_id,p_semester_id,(select auth.uid()),v_path,p_file_name,p_student_count,p_issued_on,p_content_fingerprint)
 on conflict do nothing
 returning id into v_stored_id;

 if v_stored_id is null then
  select a.id into v_stored_id
    from public.mutabaah_report_archives a
   where a.class_id=p_class_id
     and a.semester_id=p_semester_id
     and a.content_fingerprint=p_content_fingerprint
   limit 1;
  if v_stored_id is null then
    raise exception 'Arsip tidak dapat dicatat karena konflik data';
  end if;
  return jsonb_build_object('created',false,'id',v_stored_id);
 end if;
 return jsonb_build_object('created',true,'id',v_stored_id);
end
$function$
;
CREATE TRIGGER fixture_semester_protection BEFORE UPDATE ON semesters FOR EACH ROW EXECUTE FUNCTION protect_mutabaah_semester_dates();
