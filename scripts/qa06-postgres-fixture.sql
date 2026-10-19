DO $$ BEGIN IF current_database()<>'qa06_fixture' OR current_setting('port')<>'55436' THEN RAISE EXCEPTION 'LOCAL FIXTURE ONLY'; END IF; END $$;
-- LOCAL FIXTURE ONLY. Never run this file on production.
-- Uses selected server function bodies/policy predicates, synthetic identities only.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
CREATE TABLE profiles(user_id uuid PRIMARY KEY,account_status text);
CREATE TABLE user_roles(user_id uuid,role text);
CREATE TABLE students(id uuid PRIMARY KEY,status text);
CREATE TABLE academic_years(id uuid PRIMARY KEY,starts_on date,ends_on date);
CREATE TABLE classes(id uuid PRIMARY KEY,academic_year_id uuid);
CREATE TABLE student_enrollments(id uuid PRIMARY KEY,student_id uuid,class_id uuid,starts_on date,ends_on date);
CREATE TABLE student_guardians(student_id uuid,guardian_id uuid,PRIMARY KEY(student_id,guardian_id));
CREATE TABLE homeroom_assignments(class_id uuid,teacher_id uuid);
CREATE TABLE mutabaah_day_submissions(student_id uuid,entry_date date,status text,PRIMARY KEY(student_id,entry_date));
CREATE TABLE parent_reminder_deliveries(guardian_id uuid,reminder_date date,status text,attempted_at timestamptz DEFAULT now(),sent_at timestamptz,error text,PRIMARY KEY(guardian_id,reminder_date));
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;
INSERT INTO profiles SELECT ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,CASE WHEN i=6 THEN 'inactive' ELSE 'active' END FROM generate_series(1,6)i;
INSERT INTO user_roles SELECT user_id,CASE right(user_id::text,1) WHEN '3' THEN 'homeroom_teacher' WHEN '4' THEN 'principal' WHEN '5' THEN 'admin' ELSE 'parent' END FROM profiles;
INSERT INTO students SELECT ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'active' FROM generate_series(1,3)i;
INSERT INTO academic_years VALUES('40000000-0000-4000-8000-000000000001','2026-07-01','2027-06-30');
INSERT INTO classes SELECT ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'40000000-0000-4000-8000-000000000001' FROM generate_series(1,2)i;
INSERT INTO student_enrollments SELECT id,id,CASE WHEN right(id::text,1)='3' THEN '30000000-0000-4000-8000-000000000002'::uuid ELSE '30000000-0000-4000-8000-000000000001'::uuid END,'2026-07-01',NULL FROM students;
INSERT INTO student_guardians SELECT id,CASE WHEN right(id::text,1)='3' THEN '10000000-0000-4000-8000-000000000002'::uuid ELSE '10000000-0000-4000-8000-000000000001'::uuid END FROM students;
INSERT INTO student_guardians VALUES('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000006');
INSERT INTO homeroom_assignments VALUES('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003');
INSERT INTO mutabaah_day_submissions VALUES('20000000-0000-4000-8000-000000000003','2026-10-18','finalized');

CREATE FUNCTION public.has_role(requested_role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$select exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role=requested_role)$fn$;
CREATE FUNCTION public.list_parent_reminder_targets(p_date date) RETURNS TABLE(guardian_id uuid,pending_children integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $fn$
SELECT x.guardian_id, count(DISTINCT x.student_id)::integer AS pending_children
FROM (
 SELECT g.guardian_id, g.student_id
 FROM public.student_guardians g
 JOIN public.profiles p ON p.user_id=g.guardian_id AND p.account_status='active'
 JOIN public.user_roles r ON r.user_id=g.guardian_id AND r.role='parent'
 JOIN public.student_enrollments e ON e.student_id=g.student_id
 JOIN public.classes c ON c.id=e.class_id
 JOIN public.academic_years ay ON ay.id=c.academic_year_id
 LEFT JOIN public.mutabaah_day_submissions sub ON sub.student_id=g.student_id AND sub.entry_date=p_date
 WHERE p_date IS NOT NULL
   AND e.starts_on<=p_date AND (e.ends_on IS NULL OR e.ends_on>=p_date)
   AND ay.starts_on<=p_date AND ay.ends_on>=p_date
   AND sub.status IS DISTINCT FROM 'finalized'
) x
GROUP BY x.guardian_id;
$fn$;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY students_read ON public.students FOR SELECT TO authenticated USING ((has_role('admin'::text) OR has_role('principal'::text) OR (EXISTS ( SELECT 1
   FROM student_guardians g
  WHERE ((g.student_id = students.id) AND (g.guardian_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (student_enrollments e
     JOIN homeroom_assignments h ON ((h.class_id = e.class_id)))
  WHERE ((e.student_id = students.id) AND (h.teacher_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY students_admin ON public.students FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY guardians_read ON public.student_guardians FOR SELECT TO authenticated USING ((has_role('admin'::text) OR (guardian_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY guardians_admin ON public.student_guardians FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrollments_read ON public.student_enrollments FOR SELECT TO authenticated USING ((has_role('admin'::text) OR has_role('principal'::text) OR (EXISTS ( SELECT 1
   FROM student_guardians g
  WHERE ((g.student_id = student_enrollments.student_id) AND (g.guardian_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM homeroom_assignments h
  WHERE ((h.class_id = student_enrollments.class_id) AND (h.teacher_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY enrollments_admin ON public.student_enrollments FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
