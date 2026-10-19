-- LOCAL ONLY. Synthetic thresholds/targets; no production settings copied or changed.
DO $$ BEGIN IF current_database()<>'qa06_fixture' OR current_setting('port')<>'55436' THEN RAISE EXCEPTION 'LOCAL FIXTURE ONLY'; END IF; END $$;
ALTER TABLE students ADD COLUMN full_name text,ADD COLUMN nis text;
UPDATE students SET full_name='CODEX-UJI-20261016 fixture',nis='FIXTURE';
ALTER TABLE mutabaah_activities ADD COLUMN report_group text,ADD COLUMN report_target numeric,ADD COLUMN sort_order integer;
UPDATE mutabaah_activities SET report_group=category,report_target=30,sort_order=1;
CREATE TABLE mutabaah_report_grading(id boolean PRIMARY KEY,grade_a_min numeric,grade_b_min numeric,grade_c_min numeric,kkm numeric);
INSERT INTO mutabaah_report_grading VALUES(true,90,80,70,75);
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
CREATE OR REPLACE FUNCTION public.get_mutabaah_semester_report(p_class_id uuid, p_semester_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_start date;v_end date;v_today date;v_result jsonb;v_a numeric;v_b numeric;v_c numeric;v_kkm numeric;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if not(public.has_role('admin') or public.has_role('principal') or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=auth.uid())) then raise exception 'Akses kelas ditolak'; end if;
 select s.starts_on,s.ends_on into v_start,v_end from public.semesters s join public.classes c on c.academic_year_id=s.academic_year_id where s.id=p_semester_id and c.id=p_class_id;
 if not found then raise exception 'Semester tidak sesuai kelas'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 v_end:=least(v_end,v_today);
 if v_start>v_today then raise exception 'Semester belum dimulai'; end if;
 select grade_a_min,grade_b_min,grade_c_min,kkm into v_a,v_b,v_c,v_kkm from public.mutabaah_report_grading where id=true;
 with enrolled as(
 select distinct s.id,s.full_name,s.nis from public.students s join public.student_enrollments e on e.student_id=s.id where e.class_id=p_class_id and e.starts_on<=v_end and coalesce(e.ends_on,v_end)>=v_start
 ), days as(
 select e.student_id,gs::date dt from public.student_enrollments e join enrolled st on st.id=e.student_id
 cross join lateral generate_series(greatest(e.starts_on,v_start),least(coalesce(e.ends_on,v_end),v_end),interval '1 day') gs
 where e.class_id=p_class_id group by e.student_id,gs::date
 ), daily as(
 select d.student_id,d.dt,
 case when sub.status='finalized' then 1 else 0 end as is_final,
 count(a.id) filter(where not public.mutabaah_is_exempt(a.id,d.student_id,d.dt))::integer possible,
 count(m.activity_id) filter(where m.completed is true and sub.status='finalized' and not public.mutabaah_is_exempt(a.id,d.student_id,d.dt))::integer achieved
 from days d
 left join public.mutabaah_day_submissions sub on sub.student_id=d.student_id and sub.entry_date=d.dt
 cross join public.mutabaah_activities a
 left join public.mutabaah_entries m on m.student_id=d.student_id and m.entry_date=d.dt and m.activity_id=a.id
 where a.is_active and a.scoring_mode='required' group by d.student_id,d.dt,sub.status
 ), totals as(
 select student_id,count(*)::integer days,sum(is_final)::integer final_days,
 sum(possible)::integer possible,sum(achieved)::integer achieved from daily group by student_id
 ), scored as(
 select st.id,st.full_name,st.nis,coalesce(t.days,0) days,coalesce(t.final_days,0) final_days,coalesce(t.possible,0) possible,coalesce(t.achieved,0) achieved,
 case when coalesce(t.possible,0)>0 then round(100.0*t.achieved/t.possible,2) else 0::numeric end pct
 from enrolled st left join totals t on t.student_id=st.id
 ), graded as(
 select sc.*,case when pct>=v_a then 'A' when pct>=v_b then 'B' when pct>=v_c then 'C' else 'D' end grade
 from scored sc
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',id,'name',full_name,'nis',nis,'days',days,'finalized_days',final_days,'pending_days',days-final_days,
 'yes_count',achieved,'expected_count',possible,'percentage',pct,'grade',grade,'kkm',v_kkm,
 'meets_kkm',pct>=v_kkm,'is_complete',final_days=days and days>0,
 'note',case
 when grade='A' then 'Ananda '||full_name||' menunjukkan pembiasaan ibadah dan akhlak yang sangat baik serta konsisten dalam menjalankan kegiatan Mutabaah Yaumiah. Pertahankan kebiasaan positif ini dalam kehidupan sehari-hari.'
 when grade='B' then 'Ananda '||full_name||' menunjukkan pembiasaan ibadah dan akhlak yang baik. Terus tingkatkan kedisiplinan dan konsistensi agar kebiasaan positif semakin tertanam dalam kehidupan sehari-hari.'
 when grade='C' then 'Ananda '||full_name||' telah menunjukkan perkembangan dalam pembiasaan ibadah dan akhlak. Perlu meningkatkan keteraturan dan kesungguhan dalam menjalankan kegiatan Mutabaah Yaumiah.'
 else 'Ananda '||full_name||' masih memerlukan bimbingan dan pendampingan dalam membiasakan ibadah serta perilaku positif. Diharapkan adanya kerja sama antara orang tua dan sekolah untuk meningkatkan kedisiplinan secara bertahap.'
 end
 ) order by full_name,id),'[]'::jsonb) into v_result from graded;
 return v_result;
end $function$
;
-- Install exact calendar reader after all required activity columns exist.
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
