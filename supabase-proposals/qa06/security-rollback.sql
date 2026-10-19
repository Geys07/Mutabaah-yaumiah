-- Emergency rollback of this delta only; preserves prior production fixes.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_student_with_class(p_student_id uuid, p_full_name text, p_nis text, p_nisn text, p_gender text, p_class_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_year uuid; v_start date; v_current_class uuid;
begin
 if not public.has_role('admin') then raise exception 'Akses ditolak'; end if;
 if length(trim(coalesce(p_full_name,''))) < 2 then raise exception 'Nama siswa minimal 2 karakter'; end if;
 if p_gender is not null and p_gender not in ('male','female') then raise exception 'Jenis kelamin tidak valid'; end if;
 select c.academic_year_id, ay.starts_on into v_year,v_start from public.classes c join public.academic_years ay on ay.id=c.academic_year_id where c.id=p_class_id;
 if v_year is null then raise exception 'Kelas tidak ditemukan'; end if;
 if p_student_id is null then
  insert into public.students(full_name,nis,nisn,gender,status,enrolled_on)
  values(trim(p_full_name),nullif(trim(coalesce(p_nis,'')),''),nullif(trim(coalesce(p_nisn,'')),''),p_gender,'active',v_start)
  returning id into v_id;
 else
  update public.students set full_name=trim(p_full_name),nis=nullif(trim(coalesce(p_nis,'')),''),nisn=nullif(trim(coalesce(p_nisn,'')),''),gender=p_gender where id=p_student_id returning id into v_id;
  if v_id is null then raise exception 'Siswa tidak ditemukan'; end if;
 end if;
 select class_id into v_current_class from public.student_enrollments where student_id=v_id and ends_on is null for update;
 if v_current_class is distinct from p_class_id then
  if v_current_class is not null then
    update public.student_enrollments set ends_on=greatest(starts_on, current_date - 1) where student_id=v_id and ends_on is null;
  end if;
  insert into public.student_enrollments(student_id,class_id,starts_on) values(v_id,p_class_id,greatest(v_start,current_date));
 end if;
 return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.create_academic_year(p_start_year integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if not public.has_role('admin') then raise exception 'Akses ditolak'; end if;
 if p_start_year < 2020 or p_start_year > 2200 then raise exception 'Tahun tidak valid'; end if;
 insert into public.academic_years(start_year,starts_on,ends_on)
 values(p_start_year,make_date(p_start_year,7,1),make_date(p_start_year+1,6,30))
 returning id into v_id;
 insert into public.semesters(academic_year_id,term,starts_on,ends_on) values
 (v_id,1,make_date(p_start_year,7,1),make_date(p_start_year,12,31)),
 (v_id,2,make_date(p_start_year+1,1,1),make_date(p_start_year+1,6,30));
 return v_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.save_student_family_contacts(p_student_id uuid, p_contacts jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_type text; v_entry jsonb; v_name text; v_phone text;
begin
 if not public.has_role('admin') then raise exception 'Akses ditolak'; end if;
 if not exists(select 1 from public.students where id=p_student_id) then raise exception 'Siswa tidak ditemukan'; end if;
 if jsonb_typeof(p_contacts) is distinct from 'object' then raise exception 'Format data keluarga tidak valid'; end if;
 if exists(select 1 from jsonb_object_keys(p_contacts) as k(key) where k.key not in ('father','mother','guardian')) then raise exception 'Jenis hubungan tidak dikenal'; end if;
 foreach v_type in array array['father','mother','guardian'] loop
  v_entry := p_contacts -> v_type;
  if v_entry is null or jsonb_typeof(v_entry) is distinct from 'object' then raise exception 'Data % tidak lengkap',v_type; end if;
  v_name := pg_catalog.btrim(coalesce(v_entry->>'full_name',''));
  v_phone := nullif(pg_catalog.btrim(coalesce(v_entry->>'phone','')),'');
  if v_name='' then
   if v_phone is not null then raise exception 'Nomor HP harus disertai nama'; end if;
   delete from public.student_family_contacts where student_id=p_student_id and relationship=v_type;
  else
   if char_length(v_name)<2 or char_length(v_name)>150 then raise exception 'Nama % tidak valid',v_type; end if;
   if v_phone is not null and v_phone !~ '^08[0-9]{8,11}$' then raise exception 'Nomor HP % tidak valid',v_type; end if;
   insert into public.student_family_contacts(student_id,relationship,full_name,phone,updated_at)
   values(p_student_id,v_type,v_name,v_phone,now())
   on conflict(student_id,relationship) do update set full_name=excluded.full_name,phone=excluded.phone,updated_at=now();
  end if;
 end loop;
end $function$
;
CREATE OR REPLACE FUNCTION public.import_students_atomic(p_academic_year_id uuid, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_count integer;
 v_row jsonb;
 v_i integer;
 v_name text;
 v_nis text;
 v_nisn text;
 v_gender text;
 v_class uuid;
 v_start date;
 v_student uuid;
 v_year uuid;
 v_seen_nis text[] := array[]::text[];
 v_seen_nisn text[] := array[]::text[];
 v_seen_name text[] := array[]::text[];
 v_fingerprint text;
begin
 if not public.has_role('admin') then raise exception 'Akses ditolak'; end if;
 if p_academic_year_id is null then raise exception 'Tahun ajaran wajib dipilih'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Format data impor salah'; end if;
 v_count := jsonb_array_length(p_rows);
 if v_count < 1 or v_count > 500 then raise exception 'Impor harus berisi 1 sampai 500 siswa per file'; end if;
 select starts_on into v_start from public.academic_years where id=p_academic_year_id;
 if v_start is null then raise exception 'Tahun ajaran tidak ditemukan'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('mutabaah_students_import'));
 for v_i in 0..v_count-1 loop
  v_row := p_rows -> v_i;
  if jsonb_typeof(v_row) is distinct from 'object' then raise exception 'Baris %: format salah',v_i+2; end if;
  v_name := pg_catalog.btrim(coalesce(v_row->>'full_name',''));
  v_nis := nullif(pg_catalog.btrim(coalesce(v_row->>'nis','')),'');
  v_nisn := nullif(pg_catalog.btrim(coalesce(v_row->>'nisn','')),'');
  v_gender := nullif(pg_catalog.btrim(coalesce(v_row->>'gender','')),'');
  if length(v_name)<2 or length(v_name)>150 then raise exception 'Baris %: nama tidak valid',v_i+2; end if;
  if length(coalesce(v_nis,''))>30 or length(coalesce(v_nisn,''))>30 then raise exception 'Baris %: NIS/NISN terlalu panjang',v_i+2; end if;
  if v_gender is not null and v_gender not in ('male','female') then raise exception 'Baris %: jenis kelamin salah',v_i+2; end if;
  if coalesce(v_row->>'class_id','') !~ '^[0-9a-fA-F-]{36}$' then raise exception 'Baris %: kelas tidak valid',v_i+2; end if;
  v_class := (v_row->>'class_id')::uuid;
  select academic_year_id into v_year from public.classes where id=v_class;
  if v_year is distinct from p_academic_year_id then raise exception 'Baris %: kelas bukan dari tahun ajaran ini',v_i+2; end if;
  if v_nis is not null then
   if v_nis = any(v_seen_nis) then raise exception 'Baris %: NIS berulang dalam file',v_i+2; end if;
   v_seen_nis := pg_catalog.array_append(v_seen_nis,v_nis);
   if exists(select 1 from public.students where nis=v_nis) then raise exception 'Baris %: NIS sudah terdaftar, impor dibatalkan',v_i+2; end if;
  end if;
  if v_nisn is not null then
   if v_nisn = any(v_seen_nisn) then raise exception 'Baris %: NISN berulang dalam file',v_i+2; end if;
   v_seen_nisn := pg_catalog.array_append(v_seen_nisn,v_nisn);
   if exists(select 1 from public.students where nisn=v_nisn) then raise exception 'Baris %: NISN sudah terdaftar, impor dibatalkan',v_i+2; end if;
  end if;
  v_fingerprint := pg_catalog.upper(pg_catalog.regexp_replace(v_name,'\s+',' ','g'));
  if v_fingerprint = any(v_seen_name) then raise exception 'Baris %: nama siswa berulang dalam file; periksa dahulu',v_i+2; end if;
  v_seen_name := pg_catalog.array_append(v_seen_name,v_fingerprint);
  if exists (select 1 from public.students where pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.btrim(full_name),'\s+',' ','g'))=v_fingerprint)
  then raise exception 'Baris %: nama serupa sudah ada; periksa siswa yang sudah terdaftar',v_i+2; end if;
 end loop;
 for v_i in 0..v_count-1 loop
  v_row := p_rows -> v_i;
  insert into public.students(full_name,nis,nisn,gender,status,enrolled_on)
  values(
   pg_catalog.btrim(v_row->>'full_name'),
   nullif(pg_catalog.btrim(coalesce(v_row->>'nis','')),''),
   nullif(pg_catalog.btrim(coalesce(v_row->>'nisn','')),''),
   nullif(pg_catalog.btrim(coalesce(v_row->>'gender','')),''),
   'active',v_start
  ) returning id into v_student;
  insert into public.student_enrollments(student_id,class_id,starts_on)
  values(v_student,(v_row->>'class_id')::uuid,GREATEST(v_start,CURRENT_DATE));
 end loop;
 return v_count;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.generate_parent_activation_code(p_student_id uuid, p_relationship text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_phone text; v_code text; v_bytes bytea; v_index integer; v_candidate integer; v_attempt integer;
begin
 if not public.has_role('admin') then raise exception 'Akses ditolak'; end if;
 if p_relationship not in ('father','mother','guardian') then raise exception 'Hubungan tidak valid'; end if;
 select phone into v_phone from public.student_family_contacts
 where student_id=p_student_id and relationship=p_relationship;
 if v_phone is null then raise exception 'Isi nomor HP kontak keluarga dahulu'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('parent_activation_code_creation'));
 for v_attempt in 1..100 loop
  v_code := '';
  while length(v_code)<4 loop
   v_bytes := extensions.gen_random_bytes(1);
   v_candidate := pg_catalog.get_byte(v_bytes,0);
   if v_candidate < 234 then
    v_code := v_code || chr(97+(v_candidate % 26));
   end if;
  end loop;
  exit when not exists(select 1 from public.parent_activation_codes where code=v_code);
 end loop;
 if exists(select 1 from public.parent_activation_codes where code=v_code) then raise exception 'Gagal membuat kode unik'; end if;
 insert into public.parent_activation_codes(student_id,relationship,phone,code,expires_at,used_at,created_at)
 values(p_student_id,p_relationship,v_phone,v_code,now()+interval '14 days',null,now())
 on conflict(student_id,relationship)
 do update set phone=excluded.phone,code=excluded.code,expires_at=excluded.expires_at,used_at=null,created_at=now();
 return v_code;
end $function$
;
CREATE OR REPLACE FUNCTION public.list_parent_contacts()
 RETURNS TABLE(student_id uuid, student_name text, nis text, class_name text, relationship text, contact_name text, phone text, account_linked boolean, activation_status text, activation_code text, expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select c.student_id,s.full_name,s.nis,
  (select cl.name from public.student_enrollments en join public.classes cl on cl.id=en.class_id where en.student_id=s.id and en.ends_on is null order by en.starts_on desc limit 1),
  c.relationship,c.full_name,c.phone,
  exists(select 1 from public.student_guardians sg join public.profiles p on p.user_id=sg.guardian_id where sg.student_id=c.student_id and sg.relationship=c.relationship and p.phone=c.phone),
  case
   when ac.id is null then 'none'
   when ac.used_at is not null then 'used'
   when ac.phone is distinct from c.phone then 'changed'
   when ac.expires_at<=now() then 'expired'
   else 'active'
  end,
  case when ac.used_at is null and ac.expires_at>now() and ac.phone=c.phone then ac.code else null end,
  ac.expires_at
 from public.student_family_contacts c
 join public.students s on s.id=c.student_id
 left join public.parent_activation_codes ac on ac.student_id=c.student_id and ac.relationship=c.relationship
 where public.has_role('admin')
 order by s.full_name,c.relationship
$function$
;
CREATE OR REPLACE FUNCTION public.save_mutabaah_report_targets(p_items jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare x record;n integer; updated_count integer:=0;
begin
 if auth.uid() is null or not public.has_role('admin') then raise exception 'Hanya admin yang dapat menyimpan target';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>250 then raise exception 'Daftar kegiatan tidak valid';end if;
 for x in select * from jsonb_to_recordset(p_items) as i(id uuid,target numeric,report_group text) loop
   if x.id is null or x.target is null or x.target<0 or x.target>100 or x.report_group not in ('Ibadah','Al-Qur’an','Akhlak','Kemandirian','Kebiasaan Baik') then raise exception 'Nilai target atau kelompok tidak valid'; end if;
   update public.mutabaah_activities set report_target=x.target,report_group=x.report_group where id=x.id and is_active;
   get diagnostics n=row_count;
   if n<>1 then raise exception 'Kegiatan tidak ditemukan';end if;
   updated_count:=updated_count+1;
 end loop;
 return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_targets()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT COALESCE(
  jsonb_agg(
   jsonb_build_object(
    'id',a.id, 'title',a.title, 'category',a.category,
    'report_group',a.report_group, 'target',a.report_target,
    'sort_order',a.sort_order
   ) ORDER BY a.sort_order,a.title
  ), '[]'::jsonb
 )
 FROM public.mutabaah_activities a
 WHERE a.is_active AND a.scoring_mode='required'
 AND auth.uid() IS NOT NULL
 AND (public.has_role('admin') OR public.has_role('principal')
      OR public.has_role('homeroom_teacher'));
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_archives_v2(p_class_id uuid, p_semester_id uuid)
 RETURNS TABLE(id uuid, storage_path text, file_name text, student_count integer, issued_on date, created_at timestamp with time zone, creator_name text, can_delete boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.mutabaah_can_read_report_class(p_class_id) then
    raise exception 'Akses arsip kelas ditolak';
  end if;
  if not exists (
    select 1 from public.classes c
    join public.semesters s on s.academic_year_id=c.academic_year_id
    where c.id=p_class_id and s.id=p_semester_id
  ) then
    raise exception 'Semester tidak sesuai kelas';
  end if;
  return query
    select a.id,a.storage_path,a.file_name,a.student_count,a.issued_on,a.created_at,
      coalesce(p.full_name,'Akun pengguna'),
      public.mutabaah_can_delete_report_archive(a.id)
    from public.mutabaah_report_archives a
    left join public.profiles p on p.user_id=a.created_by
    where a.class_id=p_class_id and a.semester_id=p_semester_id
    order by a.created_at desc;
end
$function$
;
CREATE OR REPLACE FUNCTION public.delete_mutabaah_report_archive(p_archive_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_path text;
begin
  if not public.mutabaah_can_delete_report_archive(p_archive_id) then
    raise exception 'Tidak memiliki izin menghapus arsip ini';
  end if;
  select storage_path into v_path
  from public.mutabaah_report_archives where id=p_archive_id for update;
  if v_path is null then
    raise exception 'Arsip tidak ditemukan';
  end if;
  if exists (
    select 1 from storage.objects o
    where o.bucket_id='mutabaah-report-archives' and o.name=v_path
  ) then
    raise exception 'Hapus file arsip dari Storage terlebih dahulu';
  end if;
  delete from public.mutabaah_report_archives where id=p_archive_id;
  return true;
end
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_monthly_notes(p_class_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_reports jsonb;v_statuses jsonb;v_result jsonb;v_month_start date;v_today date;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if p_month is null or p_class_id is null then raise exception 'Kelas dan bulan wajib diisi'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 v_month_start:=date_trunc('month',p_month::timestamp)::date;
 if v_month_start>v_today or v_month_start<date_trunc('month',(v_today-interval '2 years')::timestamp)::date then raise exception 'Bulan di luar rentang'; end if;
 -- Kedua fungsi sumber sudah membatasi akses kelas untuk admin, kepala, dan wali kelas.
 v_reports:=public.get_mutabaah_monthly_report(p_class_id,p_month);
 v_statuses:=public.get_mutabaah_class_month_status(p_class_id,p_month);
 with report_rows as(
 select x.id,x.name,x.yes_count,x.no_count,x.expected_count
 from jsonb_to_recordset(coalesce(v_reports,'[]'::jsonb)) as x(id uuid,name text,yes_count integer,no_count integer,expected_count integer)
 ),status_rows as(
 select x.id,x.finalized_days,x.draft_days,x.unfilled_days
 from jsonb_to_recordset(coalesce(v_statuses,'[]'::jsonb)) as x(id uuid,finalized_days integer,draft_days integer,unfilled_days integer)
 ),joined as(
 select r.id,r.name,coalesce(r.yes_count,0) as yes_count,coalesce(r.no_count,0) as no_count,coalesce(r.expected_count,0) as expected_count,
 coalesce(s.finalized_days,0) as finalized_days,coalesce(s.draft_days,0) as draft_days,coalesce(s.unfilled_days,0) as unfilled_days
 from report_rows r left join status_rows s on s.id=r.id
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',id,
 'note',case
 when finalized_days=0 and draft_days=0 then 'Belum ada pengisian Mutabaah pada periode ini. Perlu pendampingan agar pengisian harian dimulai.'
 when finalized_days=0 then 'Pengisian Mutabaah masih berupa draf ('||draft_days||' hari). Mohon melengkapi dan memfinalisasi pengisian.'
 else 'Mutabaah telah difinalisasi selama '||finalized_days||' hari; '||draft_days||' hari masih draf dan '||unfilled_days||' hari belum diisi. Tercatat '||yes_count||' kegiatan terlaksana dari '||expected_count||' kesempatan kegiatan yang berlaku. '||
 case when draft_days>0 or unfilled_days>0 then 'Pendampingan pengisian rutin masih diperlukan.'
 else 'Pertahankan pendampingan dan konsistensi kebiasaan baik.' end
 end,
 'finalized_days',finalized_days,'draft_days',draft_days,'unfilled_days',unfilled_days,
 'yes_count',yes_count,'expected_count',expected_count
 ) order by name,id),'[]'::jsonb) into v_result from joined;
 return v_result;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_grading()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 select jsonb_build_object('grade_a_min',g.grade_a_min,'grade_b_min',g.grade_b_min,'grade_c_min',g.grade_c_min,'kkm',g.kkm) into r from public.mutabaah_report_grading g where g.id=true;
 return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.set_mutabaah_report_grading(p_a numeric, p_b numeric, p_c numeric, p_kkm numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.has_role('admin') then raise exception 'Akses admin diperlukan'; end if;
 if p_a is null or p_b is null or p_c is null or p_kkm is null or not(p_a<=100 and p_a>p_b and p_b>p_c and p_c>=0 and p_kkm between 0 and 100) then raise exception 'Urutan grade atau KKM tidak valid'; end if;
 update public.mutabaah_report_grading set grade_a_min=p_a,grade_b_min=p_b,grade_c_min=p_c,kkm=p_kkm,updated_at=now() where id=true;
 return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.register_mutabaah_report_archive(p_archive_id uuid, p_class_id uuid, p_semester_id uuid, p_file_name text, p_student_count integer, p_issued_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_path text; v_end date;
begin
 if not public.mutabaah_can_write_report_class(p_class_id) then raise exception 'Tidak diizinkan menyimpan arsip kelas ini';end if;
 if p_archive_id is null or p_semester_id is null or p_issued_on is null or p_student_count not between 1 and 500 then raise exception 'Parameter arsip tidak lengkap';end if;
 select s.ends_on into v_end from public.classes c join public.semesters s on s.academic_year_id=c.academic_year_id where c.id=p_class_id and s.id=p_semester_id;
 if v_end is null then raise exception 'Semester tidak sesuai kelas';end if;
 if p_issued_on>v_end or p_issued_on>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal pengesahan tidak valid';end if;
 if p_file_name is null or length(p_file_name)>200 or right(lower(p_file_name),5)<>'.docx' then raise exception 'Nama dokumen tidak valid';end if;
 v_path:=p_class_id::text||'/'||p_semester_id::text||'/'||p_archive_id::text||'.docx';
 if not exists (select 1 from storage.objects o where o.bucket_id='mutabaah-report-archives' and o.name=v_path and o.owner_id=(select auth.uid())::text) then raise exception 'File DOCX arsip belum diunggah oleh akun Anda';end if;
 insert into public.mutabaah_report_archives(id,class_id,semester_id,created_by,storage_path,file_name,student_count,issued_on)
 values(p_archive_id,p_class_id,p_semester_id,(select auth.uid()),v_path,p_file_name,p_student_count,p_issued_on);
 return p_archive_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_archives(p_class_id uuid, p_semester_id uuid)
 RETURNS TABLE(id uuid, storage_path text, file_name text, student_count integer, issued_on date, created_at timestamp with time zone, creator_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.mutabaah_can_read_report_class(p_class_id) then raise exception 'Akses arsip kelas ditolak';end if;
 if not exists(select 1 from public.classes c join public.semesters s on s.academic_year_id=c.academic_year_id where c.id=p_class_id and s.id=p_semester_id) then raise exception 'Semester tidak sesuai kelas';end if;
 return query select a.id,a.storage_path,a.file_name,a.student_count,a.issued_on,a.created_at,coalesce(p.full_name,'Akun pengguna')
 from public.mutabaah_report_archives a
 left join public.profiles p on p.user_id=a.created_by
 where a.class_id=p_class_id and a.semester_id=p_semester_id
 order by a.created_at desc;
end $function$
;
CREATE OR REPLACE FUNCTION public.mutabaah_can_delete_report_archive(p_archive_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.mutabaah_report_archives a
      where a.id=p_archive_id
        and (
          public.has_role('admin')
          or (
            a.created_by=(select auth.uid())
            and public.mutabaah_can_write_report_class(a.class_id)
          )
        )
    )
$function$
;
CREATE OR REPLACE FUNCTION public.mutabaah_can_delete_report_storage_object(p_storage_path text, p_owner_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_archive_id uuid;
  v_class_id uuid;
  v_semester_id uuid;
  v_parts text[];
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_storage_path IS NULL THEN
    RETURN false;
  END IF;

  SELECT a.id INTO v_archive_id
  FROM public.mutabaah_report_archives a
  WHERE a.storage_path = p_storage_path;

  IF FOUND THEN
    RETURN public.mutabaah_can_delete_report_archive(v_archive_id);
  END IF;

  -- Only the uploader may clean up a file left behind by a failed archive registration.
  IF p_owner_id IS DISTINCT FROM (SELECT auth.uid())::text THEN
    RETURN false;
  END IF;

  IF p_storage_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]docx$' THEN
    RETURN false;
  END IF;

  v_parts := string_to_array(p_storage_path, '/');
  v_class_id := v_parts[1]::uuid;
  v_semester_id := v_parts[2]::uuid;

  IF NOT public.mutabaah_can_write_report_class(v_class_id) THEN
    RETURN false;
  END IF;

  RETURN EXISTS(
    SELECT 1
    FROM public.classes c
    JOIN public.semesters s
      ON s.academic_year_id = c.academic_year_id
    WHERE c.id = v_class_id
      AND s.id = v_semester_id
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_archives_v3(p_class_id uuid, p_semester_id uuid)
 RETURNS TABLE(id uuid, storage_path text, file_name text, student_count integer, issued_on date, created_at timestamp with time zone, creator_name text, can_delete boolean, content_fingerprint text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.mutabaah_can_read_report_class(p_class_id) then
   raise exception 'Akses arsip kelas ditolak';
 end if;
 if not exists(
  select 1 from public.classes c
   join public.semesters s on s.academic_year_id=c.academic_year_id
  where c.id=p_class_id and s.id=p_semester_id
 ) then
   raise exception 'Semester tidak sesuai kelas';
 end if;
 return query
 select a.id,a.storage_path,a.file_name,a.student_count,a.issued_on,a.created_at,
        coalesce(p.full_name,'Akun pengguna'),
        public.mutabaah_can_delete_report_archive(a.id),
        a.content_fingerprint
   from public.mutabaah_report_archives a
   left join public.profiles p on p.user_id=a.created_by
  where a.class_id=p_class_id and a.semester_id=p_semester_id
  order by a.created_at desc;
end
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
CREATE OR REPLACE FUNCTION public.get_mutabaah_ramadan_settings()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN auth.uid() IS NULL OR NOT public.has_role('admin') THEN '[]'::jsonb
 ELSE COALESCE(jsonb_agg(jsonb_build_object(
 'id',p.id,'year',p.start_year,'starts_on',p.starts_on,'ends_on',p.ends_on,'is_enabled',p.is_enabled,
 'activities',(
 SELECT COALESCE(jsonb_agg(jsonb_build_object('title',a.title,'is_active',a.is_active,'code',a.code) ORDER BY a.sort_order),'[]'::jsonb)
 FROM public.mutabaah_ramadan_activity_links link JOIN public.mutabaah_activities a ON a.id=link.activity_id
 WHERE link.period_id=p.id)
 ) ORDER BY p.start_year DESC),'[]'::jsonb) END
 FROM public.mutabaah_ramadan_periods p;
$function$
;
CREATE OR REPLACE FUNCTION public.get_parent_ramadan_day_activities(p_date date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN auth.uid() IS NULL OR p_date IS NULL THEN '[]'::jsonb
 ELSE COALESCE(jsonb_agg(jsonb_build_object(
 'id',a.id,'code',a.code,'title',a.title,'category',a.category,
 'sort_order',a.sort_order,'haid_rule',a.haid_rule,'allowed_weekdays',a.allowed_weekdays,
 'scoring_mode',a.scoring_mode
 ) ORDER BY a.sort_order,a.title),'[]'::jsonb) END
 FROM public.mutabaah_ramadan_periods p
 JOIN public.mutabaah_ramadan_activity_links link ON link.period_id=p.id
 JOIN public.mutabaah_activities a ON a.id=link.activity_id
 WHERE p.is_enabled AND p_date BETWEEN p.starts_on AND p.ends_on AND a.is_active;
$function$
;
CREATE OR REPLACE FUNCTION public.save_mutabaah_ramadan_period(p_start date, p_end date, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_year integer;v_id uuid;item record;v_activity uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN RAISE EXCEPTION 'Hanya admin dapat mengatur Ramadan';END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_enabled IS NULL OR p_end<p_start OR p_end>p_start+44 THEN
  RAISE EXCEPTION 'Periode harus berada dalam rentang 1 sampai 45 hari';
 END IF;
 v_year:=EXTRACT(YEAR FROM p_start)::integer;
 INSERT INTO public.mutabaah_ramadan_periods(start_year,starts_on,ends_on,is_enabled)
 VALUES(v_year,p_start,p_end,p_enabled)
 ON CONFLICT(start_year) DO UPDATE SET starts_on=excluded.starts_on,ends_on=excluded.ends_on,is_enabled=excluded.is_enabled,updated_at=now()
 RETURNING id INTO v_id;
 FOR item IN SELECT * FROM (VALUES
 ('puasa','Puasa Ramadan','exempt',10),
 ('sahur','Sahur','normal',20),
 ('tarawih','Salat Tarawih','exempt',30),
 ('witir','Salat Witir','exempt',40),
 ('tadarus','Tadarus Al-Qur’an','configurable',50),
 ('sedekah','Sedekah Ramadan','normal',60),
 ('doa','Doa dan Zikir Ramadan','normal',70)
 ) AS x(key,title,haid_rule,sort_order)
 LOOP
  INSERT INTO public.mutabaah_activities(code,title,category,sort_order,is_active,haid_rule,report_target,report_group,scoring_mode,allowed_weekdays)
  VALUES('ramadan_'||v_year::text||'_'||item.key,item.title,'ramadan',item.sort_order,true,item.haid_rule,80,'Ibadah','bonus',ARRAY[1,2,3,4,5,6,7])
  ON CONFLICT(code) DO UPDATE SET is_active=true
  RETURNING id INTO v_activity;
  INSERT INTO public.mutabaah_ramadan_activity_links(period_id,activity_id,key)
  VALUES(v_id,v_activity,item.key) ON CONFLICT(period_id,key) DO NOTHING;
 END LOOP;
 RETURN jsonb_build_object('success',true,'year',v_year,'starts_on',p_start,'ends_on',p_end,'is_enabled',p_enabled);
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
        v_now date:=(now() AT TIME ZONE 'Asia/Jakarta')::date;
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
CREATE OR REPLACE FUNCTION public.preview_mutabaah_promotion(p_source_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_source public.academic_years%ROWTYPE;
        v_target public.academic_years%ROWTYPE;
        v_already boolean;
        v_rows jsonb;
        v_total integer;
        v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN
   RAISE EXCEPTION 'Hanya admin yang dapat melihat rencana kenaikan kelas';
 END IF;
 SELECT * INTO v_source FROM public.academic_years WHERE start_year=p_source_year;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tahun ajaran sumber tidak ditemukan'; END IF;
 SELECT * INTO v_target FROM public.academic_years WHERE start_year=p_source_year+1;
 IF NOT FOUND THEN
   RETURN jsonb_build_object('source_year',p_source_year,'target_exists',false,'students','[]'::jsonb,'count',0);
 END IF;
 SELECT EXISTS (SELECT 1 FROM public.mutabaah_promotion_runs WHERE source_year_id=v_source.id) INTO v_already;
 WITH candidates AS (
   SELECT e.id AS enrollment_id,s.id AS student_id,s.full_name AS name,
          c.name AS source_class,c.grade,
          CASE WHEN c.grade=7 THEN 'VIII A'
               WHEN c.grade=8 AND upper(trim(c.name)) LIKE '% B' THEN 'IX B'
               WHEN c.grade=8 THEN 'IX A'
               ELSE NULL END AS destination
   FROM public.student_enrollments e
   JOIN public.classes c ON c.id=e.class_id
   JOIN public.students s ON s.id=e.student_id
   WHERE c.academic_year_id=v_source.id AND e.ends_on IS NULL AND s.status='active'
   ORDER BY c.grade,c.name,s.full_name,s.id
 )
 SELECT count(*),COALESCE(jsonb_agg(jsonb_build_object(
   'enrollment_id',enrollment_id,'student_id',student_id,'name',name,
   'source_class',source_class,'grade',grade,'destination',destination
 )), '[]'::jsonb)
 INTO v_total,v_rows FROM candidates;
 RETURN jsonb_build_object(
   'source_year',p_source_year,'target_year',p_source_year+1,
   'target_exists',true,'source_ends_on',v_source.ends_on,
   'target_starts_on',v_target.starts_on,
   'can_confirm',v_today>=v_target.starts_on AND NOT v_already,
   'already_confirmed',v_already,'count',v_total,'students',v_rows);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.prepare_mutabaah_grade_seven(p_start_year integer, p_split boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_year uuid;v_a uuid;v_b uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN
  RAISE EXCEPTION 'Hanya admin dapat menyiapkan kelas VII';
 END IF;
 IF p_start_year IS NULL OR p_split IS NULL THEN RAISE EXCEPTION 'Pilih tahun ajaran dan jenis rombel';END IF;
 SELECT id INTO v_year FROM public.academic_years WHERE start_year=p_start_year;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tahun ajaran belum dibuat';END IF;
 INSERT INTO public.classes(academic_year_id,grade,name)
 VALUES(v_year,7,'VII A')
 ON CONFLICT(academic_year_id,name) DO NOTHING;
 SELECT id INTO v_a FROM public.classes WHERE academic_year_id=v_year AND name='VII A' AND grade=7;
 IF v_a IS NULL THEN RAISE EXCEPTION 'Kelas VII A memiliki grade tidak sesuai';END IF;
 IF p_split THEN
  INSERT INTO public.classes(academic_year_id,grade,name)
  VALUES(v_year,7,'VII B')
  ON CONFLICT(academic_year_id,name) DO NOTHING;
  SELECT id INTO v_b FROM public.classes WHERE academic_year_id=v_year AND name='VII B' AND grade=7;
  IF v_b IS NULL THEN RAISE EXCEPTION 'Kelas VII B memiliki grade tidak sesuai';END IF;
 END IF;
 RETURN jsonb_build_object('year_id',v_year,'class_a',v_a,'class_b',v_b,
  'mode',CASE WHEN p_split THEN 'terpisah' ELSE 'gabungan' END);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_change_student_lifecycle(p_student_id uuid, p_action text, p_target_class_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_student public.students%ROWTYPE;
 v_enrollment public.student_enrollments%ROWTYPE;
 v_today date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
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
CREATE OR REPLACE FUNCTION public.get_mutabaah_student_placement_history(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student public.students%ROWTYPE;
DECLARE v_history jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN
  RAISE EXCEPTION 'Hanya Admin dapat melihat riwayat administrasi siswa';
 END IF;
 SELECT * INTO v_student FROM public.students WHERE id=p_student_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Siswa tidak ditemukan';END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'enrollment_id',e.id,'class_id',c.id,'class_name',c.name,'grade',c.grade,
  'academic_year',ay.start_year::text||'/'||(ay.start_year+1)::text,
  'starts_on',e.starts_on,'ends_on',e.ends_on,
  'year_starts_on',ay.starts_on,'year_ends_on',ay.ends_on
 ) ORDER BY e.starts_on DESC,ay.start_year DESC,e.id),'[]'::jsonb)
 INTO v_history
 FROM public.student_enrollments e
 JOIN public.classes c ON c.id=e.class_id
 JOIN public.academic_years ay ON ay.id=c.academic_year_id
 WHERE e.student_id=p_student_id;
 RETURN jsonb_build_object(
  'id',v_student.id,'name',v_student.full_name,'nis',v_student.nis,'nisn',v_student.nisn,
  'status',v_student.status,'enrolled_on',v_student.enrolled_on,'exited_on',v_student.exited_on,
  'placements',v_history);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.search_mutabaah_student_history(p_query text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN auth.uid() IS NOT NULL AND public.has_role('admin') THEN
 COALESCE(jsonb_agg(jsonb_build_object(
  'id',r.id,'name',r.full_name,'nis',r.nis,'nisn',r.nisn,'status',r.status
 ) ORDER BY r.full_name,r.id),'[]'::jsonb)
 ELSE '[]'::jsonb END
 FROM (
  SELECT s.id,s.full_name,s.nis,s.nisn,s.status
  FROM public.students s
  WHERE length(pg_catalog.btrim(coalesce(p_query,''))) BETWEEN 2 AND 100
    AND (s.full_name ILIKE '%'||pg_catalog.btrim(p_query)||'%'
      OR s.nis ILIKE '%'||pg_catalog.btrim(p_query)||'%'
      OR s.nisn ILIKE '%'||pg_catalog.btrim(p_query)||'%')
  ORDER BY s.full_name,s.id LIMIT 40
 ) r;
$function$
;
CREATE OR REPLACE FUNCTION public.set_mutabaah_semester_boundary(p_academic_year_id uuid, p_semester_two_starts_on date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_year public.academic_years%ROWTYPE;
        v_s1 public.semesters%ROWTYPE;
        v_s2 public.semesters%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role('admin') THEN
  RAISE EXCEPTION 'Hanya Admin dapat mengubah batas semester';
 END IF;
 SELECT * INTO v_year FROM public.academic_years WHERE id=p_academic_year_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tahun ajaran tidak ditemukan';END IF;
 IF p_semester_two_starts_on IS NULL
   OR p_semester_two_starts_on < v_year.starts_on + 30
   OR p_semester_two_starts_on > v_year.ends_on - 29 THEN
  RAISE EXCEPTION 'Tanggal Semester Genap harus berada dalam tahun ajaran, dengan masing-masing semester minimal 30 hari';
 END IF;
 SELECT * INTO v_s1 FROM public.semesters
  WHERE academic_year_id=v_year.id AND term=1 FOR UPDATE;
 SELECT * INTO v_s2 FROM public.semesters
  WHERE academic_year_id=v_year.id AND term=2 FOR UPDATE;
 IF v_s1.id IS NULL OR v_s2.id IS NULL THEN
  RAISE EXCEPTION 'Semester Ganjil dan Genap harus lengkap';
 END IF;
 IF EXISTS(
  SELECT 1 FROM public.mutabaah_report_archives a
  WHERE a.semester_id IN(v_s1.id,v_s2.id)
 ) THEN
  RAISE EXCEPTION 'Tanggal tidak dapat diubah karena rapor sudah diterbitkan';
 END IF;
 IF v_s1.starts_on=v_year.starts_on
  AND v_s1.ends_on=p_semester_two_starts_on-1
  AND v_s2.starts_on=p_semester_two_starts_on
  AND v_s2.ends_on=v_year.ends_on THEN
  RETURN jsonb_build_object('success',true,'unchanged',true);
 END IF;
 -- Perbarui dalam urutan aman agar tidak ada overlap sementara
 -- yang ditolak trigger perlindungan tanggal semester.
 IF p_semester_two_starts_on > v_s2.starts_on THEN
  UPDATE public.semesters SET
   starts_on=p_semester_two_starts_on,ends_on=v_year.ends_on
   WHERE id=v_s2.id;
  UPDATE public.semesters SET
   starts_on=v_year.starts_on,ends_on=p_semester_two_starts_on-1
   WHERE id=v_s1.id;
 ELSE
  UPDATE public.semesters SET
   starts_on=v_year.starts_on,ends_on=p_semester_two_starts_on-1
   WHERE id=v_s1.id;
  UPDATE public.semesters SET
   starts_on=p_semester_two_starts_on,ends_on=v_year.ends_on
   WHERE id=v_s2.id;
 END IF;
 RETURN jsonb_build_object('success',true,'unchanged',false,
  'year',v_year.start_year,'ganjil_starts_on',v_year.starts_on,
  'ganjil_ends_on',p_semester_two_starts_on-1,
  'genap_starts_on',p_semester_two_starts_on,'genap_ends_on',v_year.ends_on);
END;
$function$
;
DROP POLICY IF EXISTS postqa06_active ON public.academic_years;
DROP POLICY IF EXISTS postqa06_active ON public.semesters;
DROP POLICY IF EXISTS postqa06_active ON public.classes;
DROP POLICY IF EXISTS postqa06_active ON public.mutabaah_activities;
DROP POLICY IF EXISTS postqa06_active ON public.parent_phone_change_requests;
COMMIT;
