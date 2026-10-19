DO $$ BEGIN IF current_database()<>'postqa06_fixture' OR current_setting('port')<>'55436' THEN RAISE EXCEPTION 'LOCAL FIXTURE ONLY'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;CREATE SCHEMA storage;CREATE TABLE storage.objects(id uuid,bucket_id text,name text,owner_id text);CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;CREATE FUNCTION storage.filename(text) RETURNS text LANGUAGE sql AS $$ SELECT (string_to_array($1,'/'))[array_length(string_to_array($1,'/'),1)] $$;

CREATE TABLE public.mutabaah_activities ("sort_order" integer DEFAULT 0 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"id" uuid DEFAULT gen_random_uuid() NOT NULL,"category" text DEFAULT 'harian'::text NOT NULL,"haid_rule" text DEFAULT 'normal'::text NOT NULL,"report_target" numeric(5,2) DEFAULT 80 NOT NULL,"scoring_mode" text DEFAULT 'required'::text NOT NULL,"allowed_weekdays" integer[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7] NOT NULL,"title" text NOT NULL,"report_group" text NOT NULL,"code" text NOT NULL);
CREATE TABLE public.school_identity ("id" boolean DEFAULT true NOT NULL,"school_name" text DEFAULT 'MTs Al-Khairiyah'::text NOT NULL,"app_name" text DEFAULT 'Mutabaah Yaumiah'::text NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"principal_employee_number" text,"logo_path" text,"principal_name" text,"signing_location" text,"address" text);
CREATE TABLE public.academic_years ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"start_year" integer NOT NULL,"starts_on" date NOT NULL,"ends_on" date NOT NULL);
CREATE TABLE public.semesters ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"starts_on" date NOT NULL,"term" smallint NOT NULL,"ends_on" date NOT NULL,"academic_year_id" uuid NOT NULL);
CREATE TABLE public.profiles ("account_status" text DEFAULT 'active'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"full_name" text NOT NULL,"phone" text,"user_id" uuid NOT NULL);
CREATE TABLE public.classes ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"academic_year_id" uuid NOT NULL,"grade" smallint NOT NULL,"name" text NOT NULL);
CREATE TABLE public.students ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"status" text DEFAULT 'active'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"nisn" text,"exited_on" date,"nis" text,"enrolled_on" date,"gender" text,"full_name" text NOT NULL);
CREATE TABLE public.student_enrollments ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"starts_on" date NOT NULL,"class_id" uuid NOT NULL,"ends_on" date,"student_id" uuid NOT NULL);
CREATE TABLE public.app_settings ("updated_at" timestamp with time zone DEFAULT now() NOT NULL,"value" jsonb NOT NULL,"key" text NOT NULL);
CREATE TABLE public.login_attempt_limits ("window_started_at" timestamp with time zone DEFAULT now() NOT NULL,"attempts" integer DEFAULT 0 NOT NULL,"identity_key" text NOT NULL,"blocked_until" timestamp with time zone);
CREATE TABLE public.student_family_contacts ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"full_name" text NOT NULL,"relationship" text NOT NULL,"student_id" uuid NOT NULL,"phone" text);
CREATE TABLE public.parent_activation_codes ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"phone" text NOT NULL,"student_id" uuid NOT NULL,"used_at" timestamp with time zone,"code" text NOT NULL,"relationship" text NOT NULL,"expires_at" timestamp with time zone NOT NULL);
CREATE TABLE public.mutabaah_entries ("updated_at" timestamp with time zone DEFAULT now() NOT NULL,"auto_filled" boolean DEFAULT false NOT NULL,"activity_id" uuid NOT NULL,"updated_by" uuid,"entry_date" date NOT NULL,"completed" boolean NOT NULL,"student_id" uuid NOT NULL);
CREATE TABLE public.password_reset_requests ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"status" text DEFAULT 'pending'::text NOT NULL,"requested_at" timestamp with time zone DEFAULT now() NOT NULL,"code_attempts" integer DEFAULT 0 NOT NULL,"reviewed_at" timestamp with time zone,"processing_started_at" timestamp with time zone,"user_id" uuid NOT NULL,"processing_id" uuid,"lock_reason" text,"used_at" timestamp with time zone,"code_hash" text,"revoked_at" timestamp with time zone,"reviewed_by" uuid);
CREATE TABLE public.admin_push_subscriptions ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"last_error" text,"user_id" uuid NOT NULL,"auth_key" text NOT NULL,"user_agent" text,"endpoint" text NOT NULL,"last_sent_at" timestamp with time zone,"p256dh" text NOT NULL);
CREATE TABLE public.mutabaah_entry_history ("changed_at" timestamp with time zone DEFAULT now() NOT NULL,"student_id" uuid NOT NULL,"old_completed" boolean,"new_completed" boolean,"changed_by" uuid,"change_type" text NOT NULL,"activity_id" uuid NOT NULL,"id" bigint NOT NULL,"entry_date" date NOT NULL);
CREATE TABLE public.mutabaah_day_conditions ("is_haid" boolean DEFAULT false NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"student_id" uuid NOT NULL,"updated_by" uuid,"entry_date" date NOT NULL);
CREATE TABLE public.mutabaah_day_submissions ("status" text DEFAULT 'draft'::text NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"entry_date" date NOT NULL,"finalized_at" timestamp with time zone,"student_id" uuid NOT NULL,"updated_by" uuid);
CREATE TABLE public.mutabaah_report_grading ("id" boolean DEFAULT true NOT NULL,"grade_a_min" numeric(5,2) DEFAULT 90 NOT NULL,"grade_b_min" numeric(5,2) DEFAULT 80 NOT NULL,"grade_c_min" numeric(5,2) DEFAULT 70 NOT NULL,"kkm" numeric(5,2) DEFAULT 70 NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public.mutabaah_report_archives ("created_at" timestamp with time zone DEFAULT now() NOT NULL,"semester_id" uuid NOT NULL,"student_count" integer NOT NULL,"created_by" uuid NOT NULL,"id" uuid NOT NULL,"file_name" text NOT NULL,"issued_on" date NOT NULL,"storage_path" text NOT NULL,"content_fingerprint" text,"class_id" uuid NOT NULL);
CREATE TABLE public.parent_daily_notice_reads ("read_at" timestamp with time zone DEFAULT now() NOT NULL,"user_id" uuid NOT NULL,"notice_date" date NOT NULL,"student_id" uuid NOT NULL);
CREATE TABLE public.parent_push_subscriptions ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"auth_key" text NOT NULL,"guardian_id" uuid NOT NULL,"last_error" text,"p256dh" text NOT NULL,"endpoint" text NOT NULL,"last_sent_at" timestamp with time zone,"user_agent" text);
CREATE TABLE public.parent_reminder_deliveries ("status" text DEFAULT 'claimed'::text NOT NULL,"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,"sent_at" timestamp with time zone,"reminder_date" date NOT NULL,"guardian_id" uuid NOT NULL,"error" text);
CREATE TABLE public.mutabaah_ramadan_periods ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"is_enabled" boolean DEFAULT false NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"start_year" integer NOT NULL,"ends_on" date NOT NULL,"starts_on" date NOT NULL);
CREATE TABLE public.mutabaah_promotion_runs ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,"source_year_id" uuid NOT NULL,"moved_count" integer NOT NULL,"confirmed_by" uuid NOT NULL,"target_year_id" uuid NOT NULL,"graduated_count" integer NOT NULL);
CREATE TABLE public.parent_phone_change_requests ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"status" text DEFAULT 'pending'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"new_phone" text NOT NULL,"old_phone" text NOT NULL,"reviewed_at" timestamp with time zone,"reviewed_by" uuid,"guardian_id" uuid NOT NULL);
CREATE TABLE public.homeroom_assignments ("class_id" uuid NOT NULL,"teacher_id" uuid NOT NULL);
CREATE TABLE public.mutabaah_ramadan_activity_links ("activity_id" uuid NOT NULL,"period_id" uuid NOT NULL,"key" text NOT NULL);
CREATE TABLE public.user_roles ("user_id" uuid NOT NULL,"role" text NOT NULL);
CREATE TABLE public.student_guardians ("guardian_id" uuid NOT NULL,"relationship" text NOT NULL,"student_id" uuid NOT NULL);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'homeroom_teacher'::text, 'principal'::text, 'parent'::text])));
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role);
ALTER TABLE public.classes ADD CONSTRAINT classes_grade_check CHECK ((grade = ANY (ARRAY[7, 8, 9])));
ALTER TABLE public.classes ADD CONSTRAINT classes_pkey PRIMARY KEY (id);
ALTER TABLE public.classes ADD CONSTRAINT classes_academic_year_id_name_key UNIQUE (academic_year_id, name);
ALTER TABLE public.mutabaah_ramadan_activity_links ADD CONSTRAINT mutabaah_ramadan_activity_links_pkey PRIMARY KEY (period_id, key);
ALTER TABLE public.school_identity ADD CONSTRAINT school_identity_id_check CHECK (id);
ALTER TABLE public.school_identity ADD CONSTRAINT school_identity_pkey PRIMARY KEY (id);
ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_start_year_check CHECK (((start_year >= 2020) AND (start_year <= 2200)));
ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_check CHECK ((ends_on > starts_on));
ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);
ALTER TABLE public.academic_years ADD CONSTRAINT academic_years_start_year_key UNIQUE (start_year);
ALTER TABLE public.semesters ADD CONSTRAINT semesters_term_check CHECK ((term = ANY (ARRAY[1, 2])));
ALTER TABLE public.semesters ADD CONSTRAINT semesters_check CHECK ((ends_on >= starts_on));
ALTER TABLE public.semesters ADD CONSTRAINT semesters_pkey PRIMARY KEY (id);
ALTER TABLE public.semesters ADD CONSTRAINT semesters_academic_year_id_term_key UNIQUE (academic_year_id, term);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_status_check CHECK ((account_status = ANY (ARRAY['active'::text, 'disabled'::text, 'pending'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_check CHECK (((phone IS NULL) OR (phone ~ '^08[0-9]{8,11}$'::text)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_key UNIQUE (phone);
ALTER TABLE public.students ADD CONSTRAINT students_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])));
ALTER TABLE public.students ADD CONSTRAINT students_status_check CHECK ((status = ANY (ARRAY['active'::text, 'exited'::text, 'graduated'::text])));
ALTER TABLE public.students ADD CONSTRAINT students_pkey PRIMARY KEY (id);
ALTER TABLE public.student_enrollments ADD CONSTRAINT student_enrollments_check CHECK (((ends_on IS NULL) OR (ends_on >= starts_on)));
ALTER TABLE public.student_enrollments ADD CONSTRAINT student_enrollments_pkey PRIMARY KEY (id);
ALTER TABLE public.student_enrollments ADD CONSTRAINT student_enrollments_student_id_class_id_starts_on_key UNIQUE (student_id, class_id, starts_on);
ALTER TABLE public.student_guardians ADD CONSTRAINT student_guardians_relationship_check CHECK ((relationship = ANY (ARRAY['father'::text, 'mother'::text, 'guardian'::text])));
ALTER TABLE public.student_guardians ADD CONSTRAINT student_guardians_pkey PRIMARY KEY (student_id, guardian_id);
ALTER TABLE public.homeroom_assignments ADD CONSTRAINT homeroom_assignments_pkey PRIMARY KEY (class_id, teacher_id);
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.login_attempt_limits ADD CONSTRAINT login_attempt_limits_pkey PRIMARY KEY (identity_key);
ALTER TABLE public.student_family_contacts ADD CONSTRAINT student_family_contacts_relationship_check CHECK ((relationship = ANY (ARRAY['father'::text, 'mother'::text, 'guardian'::text])));
ALTER TABLE public.mutabaah_ramadan_activity_links ADD CONSTRAINT mutabaah_ramadan_activity_links_activity_id_key UNIQUE (activity_id);
ALTER TABLE public.student_family_contacts ADD CONSTRAINT student_family_contacts_full_name_check CHECK (((char_length(btrim(full_name)) >= 2) AND (char_length(btrim(full_name)) <= 150)));
ALTER TABLE public.student_family_contacts ADD CONSTRAINT student_family_contacts_phone_check CHECK (((phone IS NULL) OR (phone ~ '^08[0-9]{8,11}$'::text)));
ALTER TABLE public.student_family_contacts ADD CONSTRAINT student_family_contacts_pkey PRIMARY KEY (id);
ALTER TABLE public.student_family_contacts ADD CONSTRAINT student_family_contacts_student_id_relationship_key UNIQUE (student_id, relationship);
ALTER TABLE public.parent_activation_codes ADD CONSTRAINT parent_activation_codes_code_check CHECK ((code ~ '^[a-z]{4}$'::text));
ALTER TABLE public.parent_activation_codes ADD CONSTRAINT parent_activation_codes_relationship_check CHECK ((relationship = ANY (ARRAY['father'::text, 'mother'::text, 'guardian'::text])));
ALTER TABLE public.parent_activation_codes ADD CONSTRAINT parent_activation_codes_phone_check CHECK ((phone ~ '^08[0-9]{8,11}$'::text));
ALTER TABLE public.parent_activation_codes ADD CONSTRAINT parent_activation_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.parent_activation_codes ADD CONSTRAINT parent_activation_codes_code_key UNIQUE (code);
ALTER TABLE public.parent_activation_codes ADD CONSTRAINT parent_activation_codes_student_id_relationship_key UNIQUE (student_id, relationship);
ALTER TABLE public.mutabaah_activities ADD CONSTRAINT mutabaah_activities_pkey PRIMARY KEY (id);
ALTER TABLE public.mutabaah_activities ADD CONSTRAINT mutabaah_activities_code_key UNIQUE (code);
ALTER TABLE public.mutabaah_entries ADD CONSTRAINT mutabaah_entries_pkey PRIMARY KEY (student_id, activity_id, entry_date);
ALTER TABLE public.mutabaah_ramadan_periods ADD CONSTRAINT ramadan_period_dates_check CHECK (((ends_on >= starts_on) AND (ends_on <= (starts_on + 44)) AND (start_year = (EXTRACT(year FROM starts_on))::integer)));
ALTER TABLE public.password_reset_requests ADD CONSTRAINT password_reset_requests_code_attempts_check CHECK ((code_attempts >= 0));
ALTER TABLE public.password_reset_requests ADD CONSTRAINT password_reset_approved_has_hash CHECK (((status <> 'approved'::text) OR (code_hash IS NOT NULL)));
ALTER TABLE public.password_reset_requests ADD CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_push_subscriptions ADD CONSTRAINT admin_push_endpoint_length CHECK (((length(endpoint) >= 20) AND (length(endpoint) <= 2048)));
ALTER TABLE public.admin_push_subscriptions ADD CONSTRAINT admin_push_keys_length CHECK ((((length(p256dh) >= 20) AND (length(p256dh) <= 512)) AND ((length(auth_key) >= 8) AND (length(auth_key) <= 512))));
ALTER TABLE public.admin_push_subscriptions ADD CONSTRAINT admin_push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.admin_push_subscriptions ADD CONSTRAINT admin_push_subscriptions_endpoint_key UNIQUE (endpoint);
ALTER TABLE public.password_reset_requests ADD CONSTRAINT password_reset_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'processing'::text, 'rejected'::text, 'used'::text, 'revoked'::text])));
ALTER TABLE public.mutabaah_entry_history ADD CONSTRAINT mutabaah_entry_history_pkey PRIMARY KEY (id);
ALTER TABLE public.mutabaah_activities ADD CONSTRAINT mutabaah_activities_haid_rule_check CHECK ((haid_rule = ANY (ARRAY['normal'::text, 'exempt'::text, 'configurable'::text])));
ALTER TABLE public.mutabaah_day_conditions ADD CONSTRAINT mutabaah_day_conditions_pkey PRIMARY KEY (student_id, entry_date);
ALTER TABLE public.mutabaah_day_submissions ADD CONSTRAINT mutabaah_day_submissions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'finalized'::text])));
ALTER TABLE public.mutabaah_day_submissions ADD CONSTRAINT mutabaah_day_submissions_pkey PRIMARY KEY (student_id, entry_date);
ALTER TABLE public.mutabaah_report_grading ADD CONSTRAINT mutabaah_report_grading_id_check CHECK (id);
ALTER TABLE public.mutabaah_report_grading ADD CONSTRAINT grade_threshold_order CHECK (((grade_a_min <= (100)::numeric) AND (grade_a_min > grade_b_min) AND (grade_b_min > grade_c_min) AND (grade_c_min >= (0)::numeric) AND ((kkm >= (0)::numeric) AND (kkm <= (100)::numeric))));
ALTER TABLE public.mutabaah_report_grading ADD CONSTRAINT mutabaah_report_grading_pkey PRIMARY KEY (id);
ALTER TABLE public.mutabaah_activities ADD CONSTRAINT mutabaah_activities_report_target_check CHECK (((report_target >= (0)::numeric) AND (report_target <= (100)::numeric)));
ALTER TABLE public.mutabaah_activities ADD CONSTRAINT report_group_allowed CHECK ((report_group = ANY (ARRAY['Ibadah'::text, 'Al-Qur’an'::text, 'Akhlak'::text, 'Kemandirian'::text, 'Kebiasaan Baik'::text])));
ALTER TABLE public.mutabaah_activities ADD CONSTRAINT mutabaah_scoring_mode_values CHECK ((scoring_mode = ANY (ARRAY['required'::text, 'bonus'::text])));
ALTER TABLE public.mutabaah_report_archives ADD CONSTRAINT mutabaah_report_archives_student_count_check CHECK (((student_count >= 1) AND (student_count <= 500)));
ALTER TABLE public.mutabaah_report_archives ADD CONSTRAINT mutabaah_report_archive_filename CHECK ((((length(file_name) >= 5) AND (length(file_name) <= 200)) AND ("right"(lower(file_name), 5) = '.docx'::text)));
ALTER TABLE public.mutabaah_report_archives ADD CONSTRAINT mutabaah_report_archives_pkey PRIMARY KEY (id);
ALTER TABLE public.mutabaah_report_archives ADD CONSTRAINT mutabaah_report_archives_storage_path_key UNIQUE (storage_path);
ALTER TABLE public.mutabaah_report_archives ADD CONSTRAINT mutabaah_report_archive_fingerprint_format CHECK (((content_fingerprint IS NULL) OR (content_fingerprint ~ '^[a-f0-9]{64}$'::text)));
ALTER TABLE public.parent_daily_notice_reads ADD CONSTRAINT parent_daily_notice_reads_pkey PRIMARY KEY (user_id, student_id, notice_date);
ALTER TABLE public.parent_push_subscriptions ADD CONSTRAINT parent_push_endpoint_len CHECK (((length(endpoint) >= 20) AND (length(endpoint) <= 2048)));
ALTER TABLE public.parent_push_subscriptions ADD CONSTRAINT parent_push_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.parent_push_subscriptions ADD CONSTRAINT parent_push_subscriptions_endpoint_key UNIQUE (endpoint);
ALTER TABLE public.parent_reminder_deliveries ADD CONSTRAINT parent_reminder_deliveries_status_check CHECK ((status = ANY (ARRAY['claimed'::text, 'sent'::text, 'failed'::text])));
ALTER TABLE public.parent_reminder_deliveries ADD CONSTRAINT parent_reminder_deliveries_pkey PRIMARY KEY (guardian_id, reminder_date);
ALTER TABLE public.mutabaah_ramadan_periods ADD CONSTRAINT mutabaah_ramadan_periods_pkey PRIMARY KEY (id);
ALTER TABLE public.mutabaah_ramadan_periods ADD CONSTRAINT mutabaah_ramadan_periods_start_year_key UNIQUE (start_year);
ALTER TABLE public.mutabaah_promotion_runs ADD CONSTRAINT mutabaah_promotion_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.mutabaah_promotion_runs ADD CONSTRAINT mutabaah_promotion_runs_source_year_id_key UNIQUE (source_year_id);
ALTER TABLE public.mutabaah_promotion_runs ADD CONSTRAINT mutabaah_promotion_runs_target_year_id_key UNIQUE (target_year_id);
ALTER TABLE public.mutabaah_activities ADD CONSTRAINT mutabaah_salat_haid_must_exempt CHECK (((NOT ((category = 'shalat'::text) OR (code = ANY (ARRAY['subuh'::text, 'dzuhur'::text, 'ashar'::text, 'maghrib'::text, 'isya'::text])) OR (code ~ '^ramadan_[0-9]{4}_(tarawih|witir)$'::text))) OR (haid_rule = 'exempt'::text)));
ALTER TABLE public.parent_phone_change_requests ADD CONSTRAINT parent_phone_change_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
ALTER TABLE public.parent_phone_change_requests ADD CONSTRAINT parent_phone_change_requests_new_phone_check CHECK ((new_phone ~ '^08[0-9]{8,11}$'::text));
ALTER TABLE public.parent_phone_change_requests ADD CONSTRAINT parent_phone_change_requests_old_phone_check CHECK ((old_phone ~ '^08[0-9]{8,11}$'::text));
ALTER TABLE public.parent_phone_change_requests ADD CONSTRAINT parent_phone_change_requests_check CHECK ((old_phone <> new_phone));
ALTER TABLE public.parent_phone_change_requests ADD CONSTRAINT parent_phone_change_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.mutabaah_entry_history ADD CONSTRAINT mutabaah_entry_history_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'updated'::text, 'deleted'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;
ALTER TABLE public.semesters ADD CONSTRAINT semesters_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id);
ALTER TABLE public.classes ADD CONSTRAINT classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id);
ALTER TABLE public.student_enrollments ADD CONSTRAINT student_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE public.student_enrollments ADD CONSTRAINT student_enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE public.student_guardians ADD CONSTRAINT student_guardians_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id);
ALTER TABLE public.student_guardians ADD CONSTRAINT student_guardians_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES profiles(user_id);
ALTER TABLE public.homeroom_assignments ADD CONSTRAINT homeroom_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id);
ALTER TABLE public.homeroom_assignments ADD CONSTRAINT homeroom_assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(user_id);
ALTER TABLE public.student_family_contacts ADD CONSTRAINT student_family_contacts_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.parent_activation_codes ADD CONSTRAINT parent_activation_codes_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.mutabaah_entries ADD CONSTRAINT mutabaah_entries_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.mutabaah_entries ADD CONSTRAINT mutabaah_entries_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES mutabaah_activities(id);
ALTER TABLE public.mutabaah_entries ADD CONSTRAINT mutabaah_entries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public.password_reset_requests ADD CONSTRAINT password_reset_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.password_reset_requests ADD CONSTRAINT password_reset_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.admin_push_subscriptions ADD CONSTRAINT admin_push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.mutabaah_entry_history ADD CONSTRAINT mutabaah_entry_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.mutabaah_entry_history ADD CONSTRAINT mutabaah_entry_history_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES mutabaah_activities(id);
ALTER TABLE public.mutabaah_entry_history ADD CONSTRAINT mutabaah_entry_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.mutabaah_day_conditions ADD CONSTRAINT mutabaah_day_conditions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.mutabaah_day_conditions ADD CONSTRAINT mutabaah_day_conditions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.mutabaah_day_submissions ADD CONSTRAINT mutabaah_day_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.mutabaah_day_submissions ADD CONSTRAINT mutabaah_day_submissions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.mutabaah_report_archives ADD CONSTRAINT mutabaah_report_archives_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT;
ALTER TABLE public.mutabaah_report_archives ADD CONSTRAINT mutabaah_report_archives_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE RESTRICT;
ALTER TABLE public.mutabaah_report_archives ADD CONSTRAINT mutabaah_report_archives_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.parent_daily_notice_reads ADD CONSTRAINT parent_daily_notice_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.parent_daily_notice_reads ADD CONSTRAINT parent_daily_notice_reads_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE public.parent_push_subscriptions ADD CONSTRAINT parent_push_subscriptions_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.parent_reminder_deliveries ADD CONSTRAINT parent_reminder_deliveries_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.mutabaah_ramadan_activity_links ADD CONSTRAINT mutabaah_ramadan_activity_links_period_id_fkey FOREIGN KEY (period_id) REFERENCES mutabaah_ramadan_periods(id) ON DELETE RESTRICT;
ALTER TABLE public.mutabaah_ramadan_activity_links ADD CONSTRAINT mutabaah_ramadan_activity_links_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES mutabaah_activities(id) ON DELETE RESTRICT;
ALTER TABLE public.mutabaah_promotion_runs ADD CONSTRAINT mutabaah_promotion_runs_source_year_id_fkey FOREIGN KEY (source_year_id) REFERENCES academic_years(id);
ALTER TABLE public.mutabaah_promotion_runs ADD CONSTRAINT mutabaah_promotion_runs_target_year_id_fkey FOREIGN KEY (target_year_id) REFERENCES academic_years(id);
ALTER TABLE public.mutabaah_promotion_runs ADD CONSTRAINT mutabaah_promotion_runs_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES auth.users(id);
ALTER TABLE public.parent_phone_change_requests ADD CONSTRAINT parent_phone_change_requests_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES profiles(user_id);
ALTER TABLE public.parent_phone_change_requests ADD CONSTRAINT parent_phone_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(user_id);
SET check_function_bodies=false;
CREATE OR REPLACE FUNCTION public.cancel_stuck_password_reset(p_request_id uuid, p_admin_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Akses ditolak'; end if;
 if p_request_id is null or p_admin_id is null then return false; end if;
 if not exists(select 1 from public.user_roles ur join public.profiles p on p.user_id=ur.user_id where ur.user_id=p_admin_id and ur.role='admin' and p.account_status='active') then return false; end if;
 update public.password_reset_requests set status='revoked',revoked_at=now(),lock_reason='Proses tidak selesai; ditutup admin setelah pemeriksaan',processing_id=null,processing_started_at=null
 where id=p_request_id and user_id<>p_admin_id and status='processing' and processing_started_at < now()-interval '5 minutes';
 get diagnostics n=row_count;
 return n=1;
end $function$
;
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(p_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_allowed boolean;
begin
 if length(p_key) > 128 or length(p_key) < 16 then return false; end if;
 insert into public.login_attempt_limits(identity_key,window_started_at,attempts,blocked_until)
 values(p_key,now(),1,null)
 on conflict(identity_key) do update
 set attempts=case when public.login_attempt_limits.window_started_at < now()-interval '15 minutes' then 1 else public.login_attempt_limits.attempts+1 end,
 window_started_at=case when public.login_attempt_limits.window_started_at < now()-interval '15 minutes' then now() else public.login_attempt_limits.window_started_at end,
 blocked_until=case
 when public.login_attempt_limits.window_started_at < now()-interval '15 minutes' then null
 when public.login_attempt_limits.attempts+1 >= 6 then now()+interval '15 minutes'
 else public.login_attempt_limits.blocked_until end
 returning (attempts<=5 and (blocked_until is null or blocked_until<=now())) into v_allowed;
 return coalesce(v_allowed,false);
end $function$
;
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
CREATE OR REPLACE FUNCTION public.has_role(requested_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.user_id=r.user_id
    WHERE r.user_id=(SELECT auth.uid())
      AND r.role=requested_role
      AND p.account_status='active'
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles r
    JOIN public.profiles p ON p.user_id=r.user_id
    WHERE r.user_id=(SELECT auth.uid())
      AND r.role IN ('admin','principal','homeroom_teacher')
      AND p.account_status='active'
  );
$function$
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
 order by case when r.status='pending' then 0 else 1 end, r.requested_at desc
 limit 300
$function$
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
CREATE OR REPLACE FUNCTION public.password_reset_pending_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select case when public.has_role('admin') and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.account_status='active')
 then (select count(*)::integer from public.password_reset_requests where status='pending')
 else 0 end
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
CREATE OR REPLACE FUNCTION public.claim_parent_activation(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid; v_phone text; v_claim public.parent_activation_codes%rowtype; v_allowed boolean;
begin
 v_uid := auth.uid();
 if v_uid is null then raise exception 'Login diperlukan'; end if;
 if p_code !~ '^[a-z]{4}$' then raise exception 'Kode tidak valid'; end if;
 select phone into v_phone from public.profiles where user_id=v_uid and account_status='active';
 if v_phone is null then raise exception 'Nomor HP akun belum terdaftar'; end if;
 select public.check_login_rate_limit(md5('parent-claim-user:'||v_uid::text)) into v_allowed;
 if not coalesce(v_allowed,false) then raise exception 'Terlalu banyak percobaan'; end if;
 select public.check_login_rate_limit(md5('parent-claim-phone:'||v_phone)) into v_allowed;
 if not coalesce(v_allowed,false) then raise exception 'Terlalu banyak percobaan'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('parent-claim-'||v_phone));
 select * into v_claim from public.parent_activation_codes
 where code=p_code and phone=v_phone and used_at is null and expires_at>now() for update;
 if not found then raise exception 'Kode tidak valid atau kedaluwarsa'; end if;
 if not exists(select 1 from public.student_family_contacts
 where student_id=v_claim.student_id and relationship=v_claim.relationship and phone=v_phone)
 then raise exception 'Kontak keluarga sudah berubah'; end if;
 insert into public.user_roles(user_id,role) values(v_uid,'parent') on conflict do nothing;
 insert into public.student_guardians(student_id,guardian_id,relationship)
 values(v_claim.student_id,v_uid,v_claim.relationship)
 on conflict(student_id,guardian_id) do update set relationship=excluded.relationship;
 update public.parent_activation_codes set used_at=now() where id=v_claim.id;
 return v_claim.student_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_accessible_classes()
 RETURNS TABLE(class_id uuid, class_name text, grade smallint, academic_year text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select c.id,c.name,c.grade,(ay.start_year::text||'/'||(ay.start_year+1)::text)
 from public.classes c
 join public.academic_years ay on ay.id=c.academic_year_id
 where public.qa06_account_active() AND (public.has_role('admin') or public.has_role('principal')
    or exists(select 1 from public.homeroom_assignments h
              where h.class_id=c.id and h.teacher_id=auth.uid()))
 order by ay.start_year desc,c.grade,c.name
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_class_report(p_class_id uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;v_today date;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 if p_date is null or p_date>v_today or p_date<v_today-365 then raise exception 'Tanggal di luar rentang'; end if;
 if not(public.has_role('admin') or public.has_role('principal') or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=auth.uid())) then raise exception 'Akses kelas ditolak'; end if;
 if not exists(select 1 from public.classes where id=p_class_id) then raise exception 'Kelas tidak ditemukan'; end if;
 with enrolled as(
 select distinct on(e.student_id) s.id,s.full_name,s.nis from public.student_enrollments e join public.students s on s.id=e.student_id
 where e.class_id=p_class_id and e.starts_on<=p_date and(e.ends_on is null or e.ends_on>=p_date) order by e.student_id,e.starts_on desc
 ), activity_counts as (
 select e.id,
 count(a.id) filter(where not public.mutabaah_is_exempt(a.id,e.id,p_date))::integer total_count,
 count(m.activity_id) filter(where not public.mutabaah_is_exempt(a.id,e.id,p_date))::integer filled_count,
 count(m.activity_id) filter(where m.completed=true and not public.mutabaah_is_exempt(a.id,e.id,p_date))::integer yes_count,
 count(m.activity_id) filter(where m.completed=false and not public.mutabaah_is_exempt(a.id,e.id,p_date))::integer no_count
 from enrolled e cross join public.mutabaah_activities a
 left join public.mutabaah_entries m on m.student_id=e.id and m.activity_id=a.id and m.entry_date=p_date
 where a.is_active=true group by e.id
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',e.id,'name',e.full_name,'nis',e.nis,
 'yes_count',coalesce(c.yes_count,0),'no_count',coalesce(c.no_count,0),
 'filled_count',coalesce(c.filled_count,0),'total_count',coalesce(c.total_count,0)
 ) order by e.full_name),'[]'::jsonb) into v_result
 from enrolled e left join activity_counts c on c.id=e.id;
 return v_result;
end $function$
;
CREATE OR REPLACE FUNCTION public.set_homeroom_teacher(p_class_id uuid, p_teacher_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.has_role('admin') then raise exception 'Akses ditolak'; end if;
 if not exists(select 1 from public.classes where id=p_class_id) then raise exception 'Kelas tidak ditemukan'; end if;
 if p_teacher_id is not null then
  if not exists(select 1 from public.profiles where user_id=p_teacher_id and account_status='active') then raise exception 'Akun guru aktif tidak ditemukan'; end if;
  if exists(select 1 from public.user_roles where user_id=p_teacher_id and role in ('parent','principal','admin')) then raise exception 'Pilih akun khusus wali kelas'; end if;
  if not exists(select 1 from public.user_roles where user_id=p_teacher_id and role='homeroom_teacher') then raise exception 'Akun belum memiliki peran wali kelas'; end if;
 end if;
 delete from public.homeroom_assignments where class_id=p_class_id;
 if p_teacher_id is not null then
  insert into public.homeroom_assignments(class_id,teacher_id) values(p_class_id,p_teacher_id);
 end if;
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
CREATE OR REPLACE FUNCTION public.manage_existing_teacher(p_user_id uuid, p_full_name text, p_phone text, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.has_role('admin') then raise exception 'Akses ditolak'; end if;
 if p_user_id is null or p_user_id=auth.uid() then raise exception 'Akun tidak valid'; end if;
 if not exists(select 1 from public.profiles where user_id=p_user_id) then raise exception 'Akun belum terdaftar'; end if;
 if exists(select 1 from public.user_roles where user_id=p_user_id and role in ('admin','principal','parent')) then raise exception 'Akun memiliki peran lain'; end if;
 if length(btrim(coalesce(p_full_name,'')))<2 or length(btrim(p_full_name))>150 then raise exception 'Nama guru tidak valid'; end if;
 if p_phone !~ '^08[0-9]{8,11}$' then raise exception 'Nomor HP tidak valid'; end if;
 update public.profiles set full_name=btrim(p_full_name),phone=p_phone,account_status=case when p_active then 'active' else 'disabled' end,updated_at=now() where user_id=p_user_id;
 insert into public.user_roles(user_id,role) values(p_user_id,'homeroom_teacher') on conflict do nothing;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_parent_mutabaah_month(p_student_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_start date;v_end date;v_today date;v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if not(public.has_role('admin') or exists(select 1 from public.student_guardians sg join public.profiles p on p.user_id=sg.guardian_id where sg.student_id=p_student_id and sg.guardian_id=auth.uid() and p.account_status='active')) then raise exception 'Akses ditolak'; end if;
 if p_month is null then raise exception 'Bulan tidak valid'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 v_start:=date_trunc('month',p_month::timestamp)::date;
 v_end:=(v_start+interval '1 month')::date;
 if v_start>v_today or v_start<date_trunc('month',(v_today-interval '2 years')::timestamp)::date then raise exception 'Bulan di luar rentang'; end if;
 with days as(
 select distinct m.entry_date from public.mutabaah_entries m where m.student_id=p_student_id and m.entry_date>=v_start and m.entry_date<v_end
 union select c.entry_date from public.mutabaah_day_conditions c where c.student_id=p_student_id and c.entry_date>=v_start and c.entry_date<v_end
 ), totals as (
 select d.entry_date,
 count(a.id) filter(where not public.mutabaah_is_exempt(a.id,p_student_id,d.entry_date))::integer total,
 count(m.activity_id) filter(where not public.mutabaah_is_exempt(a.id,p_student_id,d.entry_date))::integer filled,
 count(m.activity_id) filter(where m.completed is true and not public.mutabaah_is_exempt(a.id,p_student_id,d.entry_date))::integer yes,
 count(m.activity_id) filter(where m.completed is false and not public.mutabaah_is_exempt(a.id,p_student_id,d.entry_date))::integer no
 from days d cross join public.mutabaah_activities a
 left join public.mutabaah_entries m on m.student_id=p_student_id and m.entry_date=d.entry_date and m.activity_id=a.id
 where a.is_active=true group by d.entry_date
 )
 select coalesce(jsonb_agg(jsonb_build_object('date',entry_date,'yes',yes,'no',no,'filled',filled,'total',total) order by entry_date),'[]'::jsonb) into v_result from totals;
 return v_result;
end $function$
;
CREATE OR REPLACE FUNCTION public.claim_password_reset_code(p_request_id uuid, p_user_id uuid, p_code_hash text, p_processing_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.password_reset_requests%rowtype; n integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Akses ditolak'; end if;
 if p_request_id is null or p_user_id is null or p_processing_id is null or p_code_hash !~ '^[0-9a-f]{64}$' then return 'invalid'; end if;
 select * into r from public.password_reset_requests where id=p_request_id and user_id=p_user_id for update;
 if not found or r.status <> 'approved' then return 'invalid'; end if;
 if r.code_attempts>=5 then return 'invalid'; end if;
 if r.code_hash is distinct from p_code_hash then
  n:=r.code_attempts+1;
  update public.password_reset_requests set code_attempts=n,status=case when n>=5 then 'revoked' else 'approved' end,revoked_at=case when n>=5 then now() else null end,lock_reason=case when n>=5 then 'Terlalu banyak kode salah' else null end where id=r.id;
  return case when n>=5 then 'revoked' else 'invalid' end;
 end if;
 update public.password_reset_requests set status='processing',processing_id=p_processing_id,processing_started_at=now() where id=r.id;
 return 'claimed';
end $function$
;
CREATE OR REPLACE FUNCTION public.finish_password_reset_code(p_request_id uuid, p_processing_id uuid, p_success boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare changed integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Akses ditolak'; end if;
 update public.password_reset_requests set status=case when p_success then 'used' else 'approved' end,
 used_at=case when p_success then now() else null end,
 processing_id=null,processing_started_at=null
 where id=p_request_id and status='processing' and processing_id=p_processing_id;
 get diagnostics changed=row_count;
 return changed=1;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_periods(p_class_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if not(public.has_role('admin') or public.has_role('principal') or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=auth.uid())) then raise exception 'Akses kelas ditolak'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'term',s.term,'starts_on',s.starts_on,'ends_on',s.ends_on,'start_year',a.start_year,'label','Semester '||s.term||' · '||a.start_year||'/'||(a.start_year+1)) order by s.starts_on desc),'[]'::jsonb)
 into r from public.classes c join public.academic_years a on a.id=c.academic_year_id join public.semesters s on s.academic_year_id=a.id where c.id=p_class_id;
 return r;
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
CREATE OR REPLACE FUNCTION public.invalidate_parent_code_on_contact_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if tg_op='DELETE' then
  update public.parent_activation_codes set expires_at=least(expires_at,now())
   where student_id=old.student_id and relationship=old.relationship and used_at is null;
  return old;
 end if;
 if old.phone is distinct from new.phone then
  update public.parent_activation_codes set expires_at=least(expires_at,now())
   where student_id=new.student_id and relationship=new.relationship and used_at is null;
 end if;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_push_subscription_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select case when public.has_role('admin') and exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.account_status='active')
then (select count(*)::integer from public.admin_push_subscriptions where user_id=auth.uid())
else 0 end $function$
;
CREATE OR REPLACE FUNCTION public.rotate_approved_password_reset_code(p_request_id uuid, p_admin_id uuid, p_code_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Akses ditolak'; end if;
 if p_request_id is null or p_admin_id is null or p_code_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 if not exists(select 1 from public.user_roles a join public.profiles ap on ap.user_id=a.user_id where a.user_id=p_admin_id and a.role='admin' and ap.account_status='active') then return false; end if;
 update public.password_reset_requests r
 set code_hash=p_code_hash,code_attempts=0,reviewed_by=p_admin_id,reviewed_at=now(),lock_reason=null
 where r.id=p_request_id and r.status='approved' and r.user_id<>p_admin_id
 and exists(select 1 from public.profiles target where target.user_id=r.user_id and target.account_status='active')
 and not exists(select 1 from public.user_roles target_role where target_role.user_id=r.user_id and target_role.role='admin');
 get diagnostics n=row_count;
 return n=1;
end $function$
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
CREATE OR REPLACE FUNCTION public.infer_mutabaah_haid_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare label_text text;
begin
 label_text:=lower(coalesce(new.code,'')||' '||coalesce(new.title,''));
 if label_text ~ '(salat|shalat|sholat|subuh|dzuhur|zuhur|ashar|asar|maghrib|isya|dhuha|duha|puasa)' then
  new.haid_rule:='exempt';
 elsif new.haid_rule='normal' and label_text ~ '(tilawah|murajaah|murojaah|hafalan|menghafal|tahfidz)' then
  new.haid_rule:='configurable';
 end if;
 return new;
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
CREATE OR REPLACE FUNCTION public.get_mutabaah_change_history(p_class_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(history_id bigint, student_name text, student_nis text, activity_title text, entry_date date, old_completed boolean, new_completed boolean, change_type text, changed_at timestamp with time zone, changed_by_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.has_role('admin') or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.account_status='active') then raise exception 'Akses admin diperlukan'; end if;
 if p_class_id is null or p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date> (now() at time zone 'Asia/Jakarta')::date or p_end_date-p_start_date>31 then raise exception 'Rentang tanggal tidak valid (maksimal 32 hari)'; end if;
 return query
 select h.id,s.full_name,s.nis,a.title,h.entry_date,h.old_completed,h.new_completed,h.change_type,h.changed_at,p.full_name
 from public.mutabaah_entry_history h
 join public.students s on s.id=h.student_id
 join public.mutabaah_activities a on a.id=h.activity_id
 left join public.profiles p on p.user_id=h.changed_by
 where h.entry_date between p_start_date and p_end_date
 and exists(select 1 from public.student_enrollments e where e.student_id=h.student_id and e.class_id=p_class_id and e.starts_on<=h.entry_date and (e.ends_on is null or e.ends_on>=h.entry_date))
 order by h.changed_at desc,h.id desc;
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
CREATE OR REPLACE FUNCTION public.set_mutabaah_haid_policy(p_quran_exempt boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not public.has_role('admin') or not exists(select 1 from public.profiles p where p.user_id=auth.uid() and p.account_status='active') then raise exception 'Akses admin diperlukan'; end if;
 if p_quran_exempt is null then raise exception 'Pilihan wajib ditentukan'; end if;
 insert into public.app_settings(key,value,updated_at) values('mutabaah_haid_quran_exempt',to_jsonb(p_quran_exempt),now())
 on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
 return true;
end $function$
;
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
CREATE OR REPLACE FUNCTION public.get_parent_mutabaah_month_status(p_student_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a date;b date;t date;r jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.student_guardians g join public.profiles p on p.user_id=g.guardian_id and p.account_status='active' where g.student_id=p_student_id and g.guardian_id=auth.uid()) then raise exception 'Akses orang tua ditolak'; end if;
 t:=(now() at time zone 'Asia/Jakarta')::date; a:=date_trunc('month',p_month::timestamp)::date;
 if p_month is null or a>t or a<date_trunc('month',(t-interval '2 years')::timestamp)::date then raise exception 'Bulan tidak valid'; end if;
 b:=least((a+interval '1 month - 1 day')::date,t);
 with dates as(select gs::date as dt from generate_series(a,b,interval '1 day') gs),
 statuses as(select d.dt,case when s.status='finalized' then 'finalized' when s.status='draft' or exists(select 1 from public.mutabaah_entries m where m.student_id=p_student_id and m.entry_date=d.dt) then 'draft' else 'unfilled' end st
 from dates d left join public.mutabaah_day_submissions s on s.student_id=p_student_id and s.entry_date=d.dt)
 select coalesce(jsonb_agg(jsonb_build_object('date',dt,'status',st) order by dt),'[]'::jsonb) into r from statuses;
 return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_class_day_status(p_class_id uuid, p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;t date;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 t:=(now() at time zone 'Asia/Jakarta')::date;
 if auth.uid() is null or p_class_id is null or p_date is null or p_date>t or p_date<t-365 then raise exception 'Parameter tidak valid'; end if;
 if not(public.has_role('admin') or public.has_role('principal') or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=auth.uid())) then raise exception 'Akses kelas ditolak'; end if;
 with enrolled as(select distinct s.id,s.full_name from public.student_enrollments e join public.students s on s.id=e.student_id where e.class_id=p_class_id and e.starts_on<=p_date and(e.ends_on is null or e.ends_on>=p_date)),
 statuses as(select e.id,e.full_name,case when x.status='finalized' then 'finalized' when x.status='draft' or exists(select 1 from public.mutabaah_entries m where m.student_id=e.id and m.entry_date=p_date) then 'draft' else 'unfilled' end st from enrolled e left join public.mutabaah_day_submissions x on x.student_id=e.id and x.entry_date=p_date)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',st) order by full_name,id),'[]'::jsonb) into r from statuses;
 return r;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_class_month_status(p_class_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a date;b date;t date;r jsonb;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 t:=(now() at time zone 'Asia/Jakarta')::date;
 if auth.uid() is null or p_class_id is null or p_month is null then raise exception 'Parameter tidak valid'; end if;
 a:=date_trunc('month',p_month::timestamp)::date;
 if a>t or a<date_trunc('month',(t-interval '2 years')::timestamp)::date then raise exception 'Bulan tidak valid'; end if;
 if not(public.has_role('admin') or public.has_role('principal') or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=auth.uid())) then raise exception 'Akses kelas ditolak'; end if;
 b:=least((a+interval '1 month - 1 day')::date,t);
 with dates as(select e.student_id,gs::date dt from public.student_enrollments e cross join lateral generate_series(greatest(e.starts_on,a),least(coalesce(e.ends_on,b),b),interval '1 day') gs where e.class_id=p_class_id group by e.student_id,gs::date),
 statuses as(select d.student_id,case when s.status='finalized' then 'finalized' when s.status='draft' or exists(select 1 from public.mutabaah_entries m where m.student_id=d.student_id and m.entry_date=d.dt) then 'draft' else 'unfilled' end st from dates d left join public.mutabaah_day_submissions s on s.student_id=d.student_id and s.entry_date=d.dt),
 totals as(select student_id,count(*) filter(where st='finalized')::integer finalized_days,count(*) filter(where st='draft')::integer draft_days,count(*) filter(where st='unfilled')::integer unfilled_days from statuses group by student_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',student_id,'finalized_days',finalized_days,'draft_days',draft_days,'unfilled_days',unfilled_days)),'[]'::jsonb) into r from totals;
 return r;
end $function$
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
CREATE OR REPLACE FUNCTION public.mutabaah_ramadan_date_allowed(p_activity uuid, p_student uuid, p_day date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_details(p_class_id uuid, p_semester_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_start date;v_end date;v_result jsonb;v_a numeric;v_b numeric;v_c numeric;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 if auth.uid() is null then raise exception 'Login diperlukan';end if;
 if not(public.has_role('admin') or public.has_role('principal') or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=auth.uid())) then raise exception 'Akses kelas ditolak';end if;
 select s.starts_on,least(s.ends_on,(now() at time zone 'Asia/Jakarta')::date) into v_start,v_end from public.semesters s join public.classes c on c.academic_year_id=s.academic_year_id where s.id=p_semester_id and c.id=p_class_id;
 if not found then raise exception 'Semester tidak sesuai kelas';end if;
 if v_start>v_end then raise exception 'Semester belum dimulai';end if;
 select grade_a_min,grade_b_min,grade_c_min into v_a,v_b,v_c from public.mutabaah_report_grading where id=true;
 with enrolled as (
 select distinct s.id,s.full_name from public.students s join public.student_enrollments e on e.student_id=s.id where e.class_id=p_class_id and e.starts_on<=v_end and coalesce(e.ends_on,v_end)>=v_start
 ), days as (
 select e.student_id,gs::date dt from public.student_enrollments e join enrolled st on st.id=e.student_id cross join lateral generate_series(greatest(v_start,e.starts_on),least(v_end,coalesce(e.ends_on,v_end)),interval '1 day') gs
 where e.class_id=p_class_id group by e.student_id,gs::date
 ), classified as (
 select d.student_id,d.dt,a.id activity_id,a.code,a.title,a.report_group,a.report_target,a.sort_order,
 case when public.mutabaah_is_exempt(a.id,d.student_id,d.dt) then 0 else 1 end possible,
 case when sub.status='finalized' and m.completed is true and not public.mutabaah_is_exempt(a.id,d.student_id,d.dt) then 1 else 0 end achieved
 from days d cross join public.mutabaah_activities a
 left join public.mutabaah_day_submissions sub on sub.student_id=d.student_id and sub.entry_date=d.dt
 left join public.mutabaah_entries m on m.student_id=d.student_id and m.activity_id=a.id and m.entry_date=d.dt
 where a.is_active and a.scoring_mode='required'
 ), grouped_activity as (
 select student_id,activity_id,code,title,report_group,report_target,sort_order,sum(possible) possible,sum(achieved) achieved,
 case when sum(possible)>0 then round(100.0*sum(achieved)/sum(possible),2) else null end pct
 from classified group by student_id,activity_id,code,title,report_group,report_target,sort_order
 ), activities_json as (
 select student_id,jsonb_agg(jsonb_build_object('id',activity_id,'code',code,'title',title,'group',report_group,'target',report_target,'percentage',pct,'grade',case when pct is null then null when pct>=v_a then 'A' when pct>=v_b then 'B' when pct>=v_c then 'C' else 'D' end,'below_target',pct<report_target,'possible',possible,'achieved',achieved) order by sort_order,title) arr from grouped_activity group by student_id
 ), grouped_groups as (
 select student_id,report_group,sum(possible) possible,sum(achieved) achieved from classified group by student_id,report_group
 ), groups_json as (
 select student_id,jsonb_agg(jsonb_build_object('group',report_group,'possible',possible,'achieved',achieved,'percentage',case when possible>0 then round(100.0*achieved/possible,2) else null end,'grade',case when possible=0 then null when 100.0*achieved/possible>=v_a then 'A' when 100.0*achieved/possible>=v_b then 'B' when 100.0*achieved/possible>=v_c then 'C' else 'D' end) order by case report_group when 'Ibadah' then 1 when 'Al-Qur’an' then 2 when 'Akhlak' then 3 when 'Kemandirian' then 4 else 5 end) arr from grouped_groups group by student_id
 ), by_month as (
 select student_id,date_trunc('month',dt::timestamp)::date month_start,sum(possible) possible,sum(achieved) achieved from classified group by student_id,date_trunc('month',dt::timestamp)::date
 ), months_json as (
 select student_id,jsonb_agg(jsonb_build_object('month',month_start,'percentage',case when possible>0 then round(100.0*achieved/possible,2) else 0 end,'possible',possible,'achieved',achieved) order by month_start) arr from by_month group by student_id
 ), base as (
 select x.* from jsonb_to_recordset(public.get_mutabaah_semester_report(p_class_id,p_semester_id)) as x(id uuid,name text,nis text,days integer,finalized_days integer,pending_days integer,yes_count integer,expected_count integer,percentage numeric,grade text,kkm numeric,meets_kkm boolean,is_complete boolean,note text)
 )
 select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('activities',coalesce(aj.arr,'[]'::jsonb),'groups',coalesce(gj.arr,'[]'::jsonb),'months',coalesce(mj.arr,'[]'::jsonb)) order by b.name,b.id),'[]'::jsonb) into v_result from base b left join activities_json aj on aj.student_id=b.id left join groups_json gj on gj.student_id=b.id left join months_json mj on mj.student_id=b.id;
 return v_result;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_semester_report(p_class_id uuid, p_semester_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_start date;v_end date;v_today date;v_result jsonb;v_a numeric;v_b numeric;v_c numeric;v_kkm numeric;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
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
CREATE OR REPLACE FUNCTION public.mutabaah_can_read_report_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select (select auth.uid()) is not null
and public.qa06_account_active()
and (
public.has_role('admin') or public.has_role('principal')
or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=(select auth.uid()))
);
$function$
;
CREATE OR REPLACE FUNCTION public.mutabaah_can_write_report_class(p_class_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select (select auth.uid()) is not null
and public.qa06_account_active()
and (
public.has_role('admin')
or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=(select auth.uid()))
);
$function$
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
CREATE OR REPLACE FUNCTION public.get_parent_daily_notice_read(p_student_id uuid, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select exists(
  select 1 from public.parent_daily_notice_reads r
  join public.student_guardians sg on sg.student_id=r.student_id and sg.guardian_id=r.user_id
  join public.profiles p on p.user_id=sg.guardian_id and p.account_status='active'
  where r.user_id=(select auth.uid()) and r.student_id=p_student_id
    and r.notice_date=p_date
    and p_date=(now() at time zone 'Asia/Jakarta')::date
);
$function$
;
CREATE OR REPLACE FUNCTION public.mark_parent_daily_notice_read(p_student_id uuid, p_date date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_date is null or p_date<>(now() at time zone 'Asia/Jakarta')::date then
    raise exception 'Tanggal notifikasi tidak valid';
  end if;
  if not exists(
    select 1 from public.student_guardians g
    join public.profiles p on p.user_id=g.guardian_id and p.account_status='active'
    where g.student_id=p_student_id and g.guardian_id=(select auth.uid())
  ) then
    raise exception 'Akses orang tua ditolak';
  end if;
  insert into public.parent_daily_notice_reads(user_id,student_id,notice_date)
  values((select auth.uid()),p_student_id,p_date)
  on conflict(user_id,student_id,notice_date) do update set read_at=now();
  return true;
end $function$
;
CREATE OR REPLACE FUNCTION public.complete_parent_activation(p_phone text, p_code text, p_user_id uuid, p_full_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_activation public.parent_activation_codes%rowtype;
 v_profile_phone text;
 v_full_name text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Akses ditolak'; end if;
 if p_phone !~ '^08[0-9]{8,11}$' or p_code !~ '^[a-z]{4}$' or p_user_id is null then raise exception 'Data aktivasi tidak valid'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('parent-activation-'||p_phone));
 select * into v_activation from public.parent_activation_codes
 where phone=p_phone and code=p_code and used_at is null and expires_at>now() for update;
 if not found then raise exception 'Kode aktivasi tidak valid atau kedaluwarsa'; end if;
 select fc.full_name into v_full_name from public.student_family_contacts fc
 where fc.student_id=v_activation.student_id and fc.relationship=v_activation.relationship and fc.phone=p_phone;
 if v_full_name is null or length(pg_catalog.btrim(v_full_name))<2 then raise exception 'Nama kontak keluarga belum tersedia di data siswa';end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Akun tidak ditemukan'; end if;
 select phone into v_profile_phone from public.profiles where user_id=p_user_id;
 if v_profile_phone is not null and v_profile_phone<>p_phone then raise exception 'Nomor HP akun berbeda'; end if;
 if exists(select 1 from public.profiles where phone=p_phone and user_id<>p_user_id) then raise exception 'Nomor HP dipakai akun lain'; end if;
 insert into public.profiles(user_id,full_name,phone,account_status)
 values(p_user_id,pg_catalog.btrim(v_full_name),p_phone,'active')
 on conflict(user_id) do update set phone=excluded.phone,full_name=excluded.full_name,updated_at=now();
 insert into public.user_roles(user_id,role) values(p_user_id,'parent') on conflict do nothing;
 insert into public.student_guardians(student_id,guardian_id,relationship)
 values(v_activation.student_id,p_user_id,v_activation.relationship)
 on conflict(student_id,guardian_id) do update set relationship=excluded.relationship;
 update public.parent_activation_codes set used_at=now() where id=v_activation.id;
 return v_activation.student_id;
end
$function$
;
CREATE OR REPLACE FUNCTION public.list_parent_reminder_targets(p_date date)
 RETURNS TABLE(guardian_id uuid, pending_children integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
CREATE OR REPLACE FUNCTION public.inherit_mutabaah_homeroom_on_class_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_teacher uuid;v_start_year integer;
BEGIN
 SELECT start_year INTO v_start_year FROM public.academic_years WHERE id=NEW.academic_year_id;
 SELECT h.teacher_id INTO v_teacher
 FROM public.homeroom_assignments h
 JOIN public.classes c ON c.id=h.class_id
 JOIN public.academic_years y ON y.id=c.academic_year_id
 JOIN public.profiles p ON p.user_id=h.teacher_id AND p.account_status='active'
 JOIN public.user_roles r ON r.user_id=h.teacher_id AND r.role='homeroom_teacher'
 WHERE y.start_year=v_start_year-1 AND c.name=NEW.name AND c.grade=NEW.grade
 ORDER BY h.teacher_id LIMIT 1;
 IF v_teacher IS NOT NULL THEN
  INSERT INTO public.homeroom_assignments(class_id,teacher_id)
  VALUES(NEW.id,v_teacher)
  ON CONFLICT(class_id,teacher_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
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
CREATE OR REPLACE FUNCTION public.parent_phone_request_verified(p_guardian_id uuid, p_new_phone text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_current text;v_id uuid;
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Hanya proses terverifikasi dapat mengirim permohonan';END IF;
 IF p_new_phone IS NULL OR p_new_phone !~ '^08[0-9]{8,11}$' THEN
  RAISE EXCEPTION 'Nomor HP baru tidak valid';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mutabaah-phone-change-'||p_guardian_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_guardian_id AND role='parent') THEN
  RAISE EXCEPTION 'Akun bukan orang tua';END IF;
 SELECT phone INTO v_current FROM public.profiles
  WHERE user_id=p_guardian_id AND account_status='active' FOR UPDATE;
 IF v_current IS NULL THEN RAISE EXCEPTION 'Nomor HP aktif tidak ditemukan';END IF;
 IF v_current=p_new_phone THEN RAISE EXCEPTION 'Nomor HP baru sama dengan nomor lama';END IF;
 IF EXISTS (SELECT 1 FROM public.profiles WHERE phone=p_new_phone AND user_id<>p_guardian_id) THEN
  RAISE EXCEPTION 'Nomor HP baru sudah digunakan akun lain';END IF;
 IF EXISTS (SELECT 1 FROM public.parent_phone_change_requests WHERE guardian_id=p_guardian_id AND status='pending') THEN
  RAISE EXCEPTION 'Masih ada permohonan perubahan nomor HP menunggu persetujuan';END IF;
 INSERT INTO public.parent_phone_change_requests(guardian_id,old_phone,new_phone)
 VALUES(p_guardian_id,v_current,p_new_phone) RETURNING id INTO v_id;
 RETURN v_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_change_history(p_class_id uuid, p_start_date date, p_end_date date, p_offset integer, p_page_size integer)
 RETURNS TABLE(history_id bigint, student_name text, student_nis text, activity_title text, entry_date date, old_completed boolean, new_completed boolean, change_type text, changed_at timestamp with time zone, changed_by_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_role('admin')
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.user_id = auth.uid() AND p.account_status = 'active'
     ) THEN
    RAISE EXCEPTION 'Akses admin diperlukan';
  END IF;

  IF p_class_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL
     OR p_end_date < p_start_date
     OR p_end_date > (now() AT TIME ZONE 'Asia/Jakarta')::date
     OR p_end_date - p_start_date > 31 THEN
    RAISE EXCEPTION 'Rentang tanggal tidak valid (maksimal 32 hari)';
  END IF;

  IF p_offset IS NULL OR p_offset < 0
     OR p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 500 THEN
    RAISE EXCEPTION 'Ukuran halaman maksimal 500 dan offset tidak boleh negatif';
  END IF;

  RETURN QUERY
  SELECT h.id, s.full_name, s.nis, a.title, h.entry_date,
         h.old_completed, h.new_completed, h.change_type, h.changed_at, p.full_name
  FROM public.mutabaah_entry_history h
  JOIN public.students s ON s.id = h.student_id
  JOIN public.mutabaah_activities a ON a.id = h.activity_id
  LEFT JOIN public.profiles p ON p.user_id = h.changed_by
  WHERE h.entry_date BETWEEN p_start_date AND p_end_date
    AND EXISTS (
      SELECT 1
      FROM public.student_enrollments e
      WHERE e.student_id = h.student_id
        AND e.class_id = p_class_id
        AND e.starts_on <= h.entry_date
        AND (e.ends_on IS NULL OR e.ends_on >= h.entry_date)
    )
  ORDER BY h.changed_at DESC, h.id DESC
  LIMIT p_page_size OFFSET p_offset;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_review_parent_phone_request(p_admin_id uuid, p_request_id uuid, p_approve boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_req public.parent_phone_change_requests%ROWTYPE;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Proses persetujuan tidak diizinkan';END IF;
 IF NOT EXISTS(
 SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id
 WHERE r.user_id=p_admin_id AND r.role='admin' AND p.account_status='active'
 ) THEN RAISE EXCEPTION 'Akun Admin tidak valid';END IF;
 SELECT * INTO v_req FROM public.parent_phone_change_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.status<>'pending' THEN RAISE EXCEPTION 'Permohonan tidak ditemukan atau sudah diproses';END IF;
 IF p_approve IS TRUE THEN
  IF EXISTS(SELECT 1 FROM public.profiles WHERE phone=v_req.new_phone AND user_id<>v_req.guardian_id) THEN
    RAISE EXCEPTION 'Nomor HP sudah digunakan akun lain';END IF;
  UPDATE public.profiles SET phone=v_req.new_phone
    WHERE user_id=v_req.guardian_id AND account_status='active' AND phone=v_req.old_phone;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nomor lama berubah atau akun tidak aktif, muat ulang';END IF;
 END IF;
 UPDATE public.parent_phone_change_requests
 SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 reviewed_at=now(),reviewed_by=p_admin_id WHERE id=p_request_id;
 RETURN jsonb_build_object('success',true,'status',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END;
$function$
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
CREATE OR REPLACE FUNCTION public.qa06_account_active()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.profiles p
 WHERE p.user_id=(SELECT auth.uid()) AND p.account_status='active');
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_bonus_counts(p_class_id uuid, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_today date:=(now() AT TIME ZONE 'Asia/Jakarta')::date;v_result jsonb;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 IF auth.uid() IS NULL OR p_class_id IS NULL OR p_start_date IS NULL OR p_end_date IS NULL
    OR p_start_date > p_end_date OR p_end_date > v_today
    OR p_start_date < v_today - 1826 OR p_end_date-p_start_date > 366
 THEN RAISE EXCEPTION 'Kelas atau rentang tanggal tidak valid';END IF;
 IF NOT(public.has_role('admin') OR public.has_role('principal')
    OR EXISTS(SELECT 1 FROM public.homeroom_assignments h WHERE h.class_id=p_class_id AND h.teacher_id=auth.uid()))
 THEN RAISE EXCEPTION 'Akses kelas ditolak';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.classes c WHERE c.id=p_class_id) THEN RAISE EXCEPTION 'Kelas tidak ditemukan';END IF;
 WITH enrolled AS (
  SELECT DISTINCT s.id,s.full_name,s.nis
  FROM public.student_enrollments e JOIN public.students s ON s.id=e.student_id
  WHERE e.class_id=p_class_id AND e.starts_on<=p_end_date AND (e.ends_on IS NULL OR e.ends_on>=p_start_date)
 ), bonus AS (
  SELECT a.id,a.title,a.sort_order
  FROM public.mutabaah_activities a
  WHERE a.scoring_mode='bonus'
    AND (a.is_active OR EXISTS(
      SELECT 1 FROM public.mutabaah_entries m
      WHERE m.activity_id=a.id AND m.entry_date BETWEEN p_start_date AND p_end_date
    ))
    AND (a.category <> 'ramadan' OR EXISTS(
      SELECT 1 FROM public.mutabaah_ramadan_activity_links link
      JOIN public.mutabaah_ramadan_periods p ON p.id=link.period_id
      WHERE link.activity_id=a.id AND p.starts_on <= p_end_date AND p.ends_on >= p_start_date
    ) OR EXISTS(
      SELECT 1 FROM public.mutabaah_entries old_m
      WHERE old_m.activity_id=a.id AND old_m.entry_date BETWEEN p_start_date AND p_end_date
    ))
 ),counted AS (
   SELECT m.student_id,m.activity_id,count(DISTINCT m.entry_date)::integer AS times
   FROM public.mutabaah_entries m
   JOIN public.mutabaah_day_submissions d
     ON d.student_id=m.student_id AND d.entry_date=m.entry_date AND d.status='finalized'
   JOIN bonus b ON b.id=m.activity_id
   WHERE m.entry_date BETWEEN p_start_date AND p_end_date AND m.completed IS TRUE
     AND NOT public.mutabaah_is_exempt(m.activity_id,m.student_id,m.entry_date)
     AND EXISTS(
       SELECT 1 FROM public.student_enrollments e
       WHERE e.class_id=p_class_id AND e.student_id=m.student_id
         AND e.starts_on<=m.entry_date AND (e.ends_on IS NULL OR e.ends_on>=m.entry_date)
     )
   GROUP BY m.student_id,m.activity_id
 )
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',s.id,'name',s.full_name,'nis',s.nis,
  'bonuses',(
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'count',COALESCE(c.times,0))
      ORDER BY b.sort_order,b.title,b.id),'[]'::jsonb)
    FROM bonus b LEFT JOIN counted c ON c.student_id=s.id AND c.activity_id=b.id
  )
 ) ORDER BY s.full_name,s.id),'[]'::jsonb) INTO v_result FROM enrolled s;
 RETURN v_result;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_monthly_report(p_class_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_start date;v_end date;v_today date;v_result jsonb;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 if auth.uid() is null then raise exception 'Login diperlukan'; end if;
 if p_month is null or p_class_id is null then raise exception 'Kelas dan bulan wajib dipilih'; end if;
 if not(public.has_role('admin') or public.has_role('principal') or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=auth.uid())) then raise exception 'Akses kelas ditolak'; end if;
 if not exists(select 1 from public.classes where id=p_class_id) then raise exception 'Kelas tidak ditemukan'; end if;
 v_today:=(now() at time zone 'Asia/Jakarta')::date;
 v_start:=date_trunc('month',p_month::timestamp)::date;
 if v_start>v_today or v_start<date_trunc('month',(v_today-interval '2 years')::timestamp)::date then raise exception 'Bulan di luar rentang'; end if;
 v_end:=least((v_start+interval '1 month - 1 day')::date,v_today);
 with enrolled as (
 select distinct s.id,s.full_name,s.nis from public.student_enrollments e join public.students s on s.id=e.student_id
 where e.class_id=p_class_id and e.starts_on<=v_end and coalesce(e.ends_on,v_end)>=v_start
 ), per_day as (
 select e.student_id,dd.day::date as day
 from public.student_enrollments e join enrolled s on s.id=e.student_id
 cross join lateral generate_series(greatest(e.starts_on,v_start),least(coalesce(e.ends_on,v_end),v_end),interval '1 day') dd(day)
 where e.class_id=p_class_id group by e.student_id,dd.day
 ), daily as (
 select d.student_id,d.day,
 count(a.id) filter(where not public.mutabaah_is_exempt(a.id,d.student_id,d.day))::integer expected,
 count(m.activity_id) filter(where not public.mutabaah_is_exempt(a.id,d.student_id,d.day))::integer filled,
 count(m.activity_id) filter(where m.completed is true and not public.mutabaah_is_exempt(a.id,d.student_id,d.day))::integer yes,
 count(m.activity_id) filter(where m.completed is false and not public.mutabaah_is_exempt(a.id,d.student_id,d.day))::integer no
 from per_day d cross join public.mutabaah_activities a
 left join public.mutabaah_entries m on m.student_id=d.student_id and m.entry_date=d.day and m.activity_id=a.id
 where a.is_active=true
 group by d.student_id,d.day
 ), totals as (
 select student_id,count(*)::integer days,
 count(*) filter(where filled>0)::integer recorded_days,
 sum(yes)::integer yes_count,sum(no)::integer no_count,
 sum(filled)::integer filled_count,sum(expected)::integer expected_count
 from daily group by student_id
 )
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',s.id,'name',s.full_name,'nis',s.nis,'days',coalesce(t.days,0),'recorded_days',coalesce(t.recorded_days,0),
 'yes_count',coalesce(t.yes_count,0),'no_count',coalesce(t.no_count,0),'filled_count',coalesce(t.filled_count,0),'expected_count',coalesce(t.expected_count,0)
 ) order by s.full_name,s.id),'[]'::jsonb) into v_result
 from enrolled s left join totals t on t.student_id=s.id;
 return v_result;
end $function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_monthly_required_report(p_class_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_today date:=(now() AT TIME ZONE 'Asia/Jakarta')::date;v_start date;v_end date;v_result jsonb;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 IF auth.uid() IS NULL OR p_class_id IS NULL OR p_month IS NULL THEN RAISE EXCEPTION 'Kelas dan bulan wajib dipilih';END IF;
 IF NOT(public.has_role('admin') OR public.has_role('principal') OR EXISTS(SELECT 1 FROM public.homeroom_assignments h WHERE h.class_id=p_class_id AND h.teacher_id=auth.uid())) THEN RAISE EXCEPTION 'Akses kelas ditolak';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.classes c WHERE c.id=p_class_id) THEN RAISE EXCEPTION 'Kelas tidak ditemukan';END IF;
 v_start:=date_trunc('month',p_month::timestamp)::date;
 IF v_start>v_today OR v_start<date_trunc('month',(v_today-interval '2 years')::timestamp)::date THEN RAISE EXCEPTION 'Bulan di luar rentang';END IF;
 v_end:=least((v_start+interval '1 month - 1 day')::date,v_today);
 WITH enrolled AS(
 SELECT DISTINCT s.id,s.full_name,s.nis FROM public.students s JOIN public.student_enrollments e ON e.student_id=s.id
 WHERE e.class_id=p_class_id AND e.starts_on<=v_end AND coalesce(e.ends_on,v_end)>=v_start
 ),days AS(
 SELECT e.student_id,g.d::date AS day
 FROM public.student_enrollments e JOIN enrolled s ON s.id=e.student_id
 CROSS JOIN LATERAL generate_series(greatest(e.starts_on,v_start),least(coalesce(e.ends_on,v_end),v_end),interval '1 day') g(d)
 WHERE e.class_id=p_class_id GROUP BY e.student_id,g.d::date
 ),daily AS(
 SELECT d.student_id,d.day,
 count(a.id) FILTER(WHERE NOT public.mutabaah_is_exempt(a.id,d.student_id,d.day))::integer expected,
 count(m.activity_id) FILTER(WHERE NOT public.mutabaah_is_exempt(a.id,d.student_id,d.day))::integer filled,
 count(m.activity_id) FILTER(WHERE m.completed IS TRUE AND sub.status='finalized' AND NOT public.mutabaah_is_exempt(a.id,d.student_id,d.day))::integer yes,
 count(m.activity_id) FILTER(WHERE m.completed IS FALSE AND sub.status='finalized' AND NOT public.mutabaah_is_exempt(a.id,d.student_id,d.day))::integer no
 FROM days d LEFT JOIN public.mutabaah_day_submissions sub ON sub.student_id=d.student_id AND sub.entry_date=d.day
 CROSS JOIN public.mutabaah_activities a
 LEFT JOIN public.mutabaah_entries m ON m.student_id=d.student_id AND m.entry_date=d.day AND m.activity_id=a.id
 WHERE a.scoring_mode='required' AND(a.is_active OR m.activity_id IS NOT NULL)
 AND(a.created_at AT TIME ZONE 'Asia/Jakarta')::date<=d.day
 GROUP BY d.student_id,d.day
 ),totals AS(
 SELECT student_id,count(*)::integer days,count(*) FILTER(WHERE filled>0)::integer recorded_days,
 coalesce(sum(yes),0)::integer yes_count,coalesce(sum(no),0)::integer no_count,
 coalesce(sum(filled),0)::integer filled_count,coalesce(sum(expected),0)::integer expected_count
 FROM daily GROUP BY student_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',s.id,'name',s.full_name,'nis',s.nis,'days',coalesce(t.days,0),'recorded_days',coalesce(t.recorded_days,0),
 'yes_count',coalesce(t.yes_count,0),'no_count',coalesce(t.no_count,0),
 'filled_count',coalesce(t.filled_count,0),'expected_count',coalesce(t.expected_count,0)
 ) ORDER BY s.full_name,s.id),'[]'::jsonb) INTO v_result
 FROM enrolled s LEFT JOIN totals t ON t.student_id=s.id;
 RETURN v_result;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_bonus(p_class_id uuid, p_semester_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_start date;v_end date;v_out jsonb;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 IF auth.uid() IS NULL OR NOT(public.has_role('admin') OR public.has_role('principal')
 OR EXISTS(SELECT 1 FROM public.homeroom_assignments h WHERE h.class_id=p_class_id AND h.teacher_id=auth.uid()))
 THEN RAISE EXCEPTION 'Akses kelas ditolak';END IF;
 SELECT s.starts_on,least(s.ends_on,(now() at time zone 'Asia/Jakarta')::date) INTO v_start,v_end
 FROM public.semesters s JOIN public.classes c ON c.academic_year_id=s.academic_year_id
 WHERE s.id=p_semester_id AND c.id=p_class_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Semester tidak sesuai kelas';END IF;
 IF v_start>v_end THEN RETURN '[]'::jsonb;END IF;
 WITH enrolled AS(
 SELECT DISTINCT st.id FROM public.students st JOIN public.student_enrollments e ON e.student_id=st.id
 WHERE e.class_id=p_class_id AND e.starts_on<=v_end AND coalesce(e.ends_on,v_end)>=v_start
 ),days AS(
 SELECT e.student_id,gs::date d FROM public.student_enrollments e JOIN enrolled x ON x.id=e.student_id
 CROSS JOIN LATERAL generate_series(greatest(e.starts_on,v_start),least(coalesce(e.ends_on,v_end),v_end),interval '1 day') gs
 WHERE e.class_id=p_class_id GROUP BY e.student_id,gs::date
 ),totals AS(
 SELECT d.student_id,a.id activity_id,a.title,a.sort_order,
 count(*) FILTER(WHERE NOT public.mutabaah_is_exempt(a.id,d.student_id,d.d))::integer possible,
 count(*) FILTER(WHERE sub.status='finalized' AND m.completed IS TRUE
 AND NOT public.mutabaah_is_exempt(a.id,d.student_id,d.d))::integer achieved
 FROM days d CROSS JOIN public.mutabaah_activities a
 LEFT JOIN public.mutabaah_day_submissions sub ON sub.student_id=d.student_id AND sub.entry_date=d.d
 LEFT JOIN public.mutabaah_entries m ON m.student_id=d.student_id AND m.entry_date=d.d AND m.activity_id=a.id
 WHERE a.scoring_mode='bonus'
 AND (a.is_active OR EXISTS(SELECT 1 FROM public.mutabaah_entries old_m
  WHERE old_m.activity_id=a.id AND old_m.entry_date BETWEEN v_start AND v_end))
 AND (a.category <> 'ramadan' OR EXISTS(
   SELECT 1 FROM public.mutabaah_ramadan_activity_links link
   JOIN public.mutabaah_ramadan_periods p ON p.id=link.period_id
   WHERE link.activity_id=a.id AND p.starts_on<=v_end AND p.ends_on>=v_start
 ) OR EXISTS(SELECT 1 FROM public.mutabaah_entries old_m
  WHERE old_m.activity_id=a.id AND old_m.entry_date BETWEEN v_start AND v_end))
 GROUP BY d.student_id,a.id,a.title,a.sort_order
 ),per_student AS(
 SELECT student_id,coalesce(jsonb_agg(jsonb_build_object('title',title,'achieved',achieved,'possible',possible)
 ORDER BY sort_order),'[]'::jsonb) bonuses FROM totals GROUP BY student_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'bonuses',coalesce(p.bonuses,'[]'::jsonb))),'[]'::jsonb)
 INTO v_out FROM enrolled e LEFT JOIN per_student p ON p.student_id=e.id;
 RETURN v_out;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_mutabaah_report_signatures(p_class_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
 if not public.qa06_account_active() then raise exception 'Akun tidak aktif'; end if;
 if auth.uid() is null then raise exception 'Login diperlukan';end if;
 if not(public.has_role('admin') or public.has_role('principal') or exists(select 1 from public.homeroom_assignments h where h.class_id=p_class_id and h.teacher_id=auth.uid())) then raise exception 'Akses kelas ditolak';end if;
 select jsonb_build_object('teacher_name',coalesce((select p.full_name from public.homeroom_assignments h join public.profiles p on p.user_id=h.teacher_id where h.class_id=p_class_id order by p.full_name limit 1),''),'principal_name',coalesce(i.principal_name,''),'principal_employee_number',coalesce(i.principal_employee_number,''),'signing_location',coalesce(i.signing_location,''),'school_name',coalesce(i.school_name,''),'address',coalesce(i.address,''),'logo_url',coalesce(i.logo_path,'')) into v_result from public.school_identity i where i.id=true;
 return coalesce(v_result,'{}'::jsonb);
end $function$
;
SET check_function_bodies=true;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated,service_role;GRANT SELECT ON storage.objects TO authenticated;GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.cancel_stuck_password_reset(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.cancel_stuck_password_reset(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.check_login_rate_limit(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(text) TO service_role;
REVOKE ALL ON FUNCTION public.save_student_with_class(uuid,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_student_with_class(uuid,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_with_class(uuid,text,text,text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.submit_parent_mutabaah_day(uuid,date,boolean,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.submit_parent_mutabaah_day(uuid,date,boolean,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_parent_mutabaah_day(uuid,date,boolean,jsonb,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.create_academic_year(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_academic_year(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_academic_year(integer) TO service_role;
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO anon;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO service_role;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO service_role;
REVOKE ALL ON FUNCTION public.save_student_family_contacts(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_student_family_contacts(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_student_family_contacts(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.list_password_reset_requests() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_password_reset_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_password_reset_requests() TO service_role;
REVOKE ALL ON FUNCTION public.import_students_atomic(uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.import_students_atomic(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_students_atomic(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.password_reset_pending_count() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.password_reset_pending_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.password_reset_pending_count() TO service_role;
REVOKE ALL ON FUNCTION public.generate_parent_activation_code(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.generate_parent_activation_code(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_parent_activation_code(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.claim_parent_activation(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_parent_activation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_parent_activation(text) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_accessible_classes() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_accessible_classes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_accessible_classes() TO service_role;
REVOKE ALL ON FUNCTION public.set_homeroom_teacher(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_homeroom_teacher(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_homeroom_teacher(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.save_mutabaah_day(uuid,date,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_mutabaah_day(uuid,date,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_mutabaah_day(uuid,date,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_class_report(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_class_report(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_class_report(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.manage_existing_teacher(uuid,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.manage_existing_teacher(uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_existing_teacher(uuid,text,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.get_parent_mutabaah_month(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_mutabaah_month(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_mutabaah_month(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.claim_password_reset_code(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.claim_password_reset_code(uuid,uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.finish_password_reset_code(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.finish_password_reset_code(uuid,uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_monthly_report(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_monthly_report(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_monthly_report(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_periods(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_periods(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_periods(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.list_parent_contacts() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_parent_contacts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_parent_contacts() TO service_role;
REVOKE ALL ON FUNCTION public.invalidate_parent_code_on_contact_change() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_parent_code_on_contact_change() TO anon;
GRANT EXECUTE ON FUNCTION public.invalidate_parent_code_on_contact_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_parent_code_on_contact_change() TO service_role;
REVOKE ALL ON FUNCTION public.admin_push_subscription_count() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_push_subscription_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_push_subscription_count() TO service_role;
REVOKE ALL ON FUNCTION public.rotate_approved_password_reset_code(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rotate_approved_password_reset_code(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.save_mutabaah_report_targets(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_mutabaah_report_targets(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_mutabaah_report_targets(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_targets() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_targets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_targets() TO service_role;
REVOKE ALL ON FUNCTION public.infer_mutabaah_haid_rule() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.infer_mutabaah_haid_rule() TO anon;
GRANT EXECUTE ON FUNCTION public.infer_mutabaah_haid_rule() TO authenticated;
GRANT EXECUTE ON FUNCTION public.infer_mutabaah_haid_rule() TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_signatures(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_signatures(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_signatures(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_parent_mutabaah_haid(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_mutabaah_haid(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_mutabaah_haid(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_change_history(uuid,date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_change_history(uuid,date,date) TO service_role;
REVOKE ALL ON FUNCTION public.set_parent_mutabaah_haid(uuid,date,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_parent_mutabaah_haid(uuid,date,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_parent_mutabaah_haid(uuid,date,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.mutabaah_is_exempt(uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutabaah_is_exempt(uuid,uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_haid_policy() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_haid_policy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_haid_policy() TO service_role;
REVOKE ALL ON FUNCTION public.set_mutabaah_haid_policy(boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_mutabaah_haid_policy(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mutabaah_haid_policy(boolean) TO service_role;
REVOKE ALL ON FUNCTION public.save_parent_mutabaah_day(uuid,date,boolean,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_parent_mutabaah_day(uuid,date,boolean,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_parent_mutabaah_day(uuid,date,boolean,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.get_parent_mutabaah_day_state(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_mutabaah_day_state(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_mutabaah_day_state(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_archives_v2(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_archives_v2(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_archives_v2(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.delete_mutabaah_report_archive(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.delete_mutabaah_report_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_mutabaah_report_archive(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_parent_mutabaah_month_status(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_mutabaah_month_status(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_mutabaah_month_status(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_class_day_status(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_class_day_status(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_class_day_status(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_class_month_status(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_class_month_status(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_class_month_status(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_monthly_notes(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_monthly_notes(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_monthly_notes(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_grading() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_grading() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_grading() TO service_role;
REVOKE ALL ON FUNCTION public.set_mutabaah_report_grading(numeric,numeric,numeric,numeric) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_mutabaah_report_grading(numeric,numeric,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mutabaah_report_grading(numeric,numeric,numeric,numeric) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_details(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_details(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_details(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_semester_report(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_semester_report(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_semester_report(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mutabaah_ramadan_date_allowed(uuid,uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutabaah_ramadan_date_allowed(uuid,uuid,date) TO anon;
GRANT EXECUTE ON FUNCTION public.mutabaah_ramadan_date_allowed(uuid,uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mutabaah_ramadan_date_allowed(uuid,uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_bonus(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_bonus(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_bonus(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mutabaah_can_read_report_class(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutabaah_can_read_report_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mutabaah_can_read_report_class(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mutabaah_can_write_report_class(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutabaah_can_write_report_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mutabaah_can_write_report_class(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.register_mutabaah_report_archive(uuid,uuid,uuid,text,integer,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_mutabaah_report_archive(uuid,uuid,uuid,text,integer,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_mutabaah_report_archive(uuid,uuid,uuid,text,integer,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_archives(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_archives(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_archives(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mutabaah_can_delete_report_archive(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutabaah_can_delete_report_archive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mutabaah_can_delete_report_archive(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mutabaah_can_delete_report_storage_object(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutabaah_can_delete_report_storage_object(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mutabaah_can_delete_report_storage_object(text,text) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_report_archives_v3(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_archives_v3(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_report_archives_v3(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.register_mutabaah_report_archive_v2(uuid,uuid,uuid,text,integer,date,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_mutabaah_report_archive_v2(uuid,uuid,uuid,text,integer,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_mutabaah_report_archive_v2(uuid,uuid,uuid,text,integer,date,text) TO service_role;
REVOKE ALL ON FUNCTION public.get_parent_daily_notice_read(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_daily_notice_read(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_daily_notice_read(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.mark_parent_daily_notice_read(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mark_parent_daily_notice_read(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_parent_daily_notice_read(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.complete_parent_activation(text,text,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.complete_parent_activation(text,text,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.list_parent_reminder_targets(date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.list_parent_reminder_targets(date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_ramadan_settings() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_ramadan_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_ramadan_settings() TO service_role;
REVOKE ALL ON FUNCTION public.get_parent_ramadan_day_activities(date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_ramadan_day_activities(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_ramadan_day_activities(date) TO service_role;
REVOKE ALL ON FUNCTION public.save_mutabaah_ramadan_period(date,date,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_mutabaah_ramadan_period(date,date,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_mutabaah_ramadan_period(date,date,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.confirm_mutabaah_promotion(integer,jsonb,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.confirm_mutabaah_promotion(integer,jsonb,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_mutabaah_promotion(integer,jsonb,integer) TO service_role;
REVOKE ALL ON FUNCTION public.preview_mutabaah_promotion(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.preview_mutabaah_promotion(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_mutabaah_promotion(integer) TO service_role;
REVOKE ALL ON FUNCTION public.inherit_mutabaah_homeroom_on_class_insert() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.inherit_mutabaah_homeroom_on_class_insert() TO anon;
GRANT EXECUTE ON FUNCTION public.inherit_mutabaah_homeroom_on_class_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION public.inherit_mutabaah_homeroom_on_class_insert() TO service_role;
REVOKE ALL ON FUNCTION public.protect_mutabaah_semester_dates() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.protect_mutabaah_semester_dates() TO anon;
GRANT EXECUTE ON FUNCTION public.protect_mutabaah_semester_dates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protect_mutabaah_semester_dates() TO service_role;
REVOKE ALL ON FUNCTION public.mutabaah_cleanup_exempt_answers_on_haid() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.mutabaah_cleanup_exempt_answers_on_haid() TO anon;
GRANT EXECUTE ON FUNCTION public.mutabaah_cleanup_exempt_answers_on_haid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mutabaah_cleanup_exempt_answers_on_haid() TO service_role;
REVOKE ALL ON FUNCTION public.parent_phone_request_verified(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.parent_phone_request_verified(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_change_history(uuid,date,date,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_change_history(uuid,date,date,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_change_history(uuid,date,date,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.admin_review_parent_phone_request(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_parent_phone_request(uuid,uuid,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.log_mutabaah_entry_change() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.log_mutabaah_entry_change() TO anon;
GRANT EXECUTE ON FUNCTION public.log_mutabaah_entry_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_mutabaah_entry_change() TO service_role;
REVOKE ALL ON FUNCTION public.prepare_mutabaah_grade_seven(integer,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.prepare_mutabaah_grade_seven(integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_mutabaah_grade_seven(integer,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.admin_change_student_lifecycle(uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_change_student_lifecycle(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_student_lifecycle(uuid,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_student_placement_history(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_student_placement_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_student_placement_history(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.search_mutabaah_student_history(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.search_mutabaah_student_history(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_mutabaah_student_history(text) TO service_role;
REVOKE ALL ON FUNCTION public.set_mutabaah_semester_boundary(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.set_mutabaah_semester_boundary(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_mutabaah_semester_boundary(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_bonus_counts(uuid,date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_bonus_counts(uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_bonus_counts(uuid,date,date) TO service_role;
REVOKE ALL ON FUNCTION public.get_mutabaah_monthly_required_report(uuid,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_monthly_required_report(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutabaah_monthly_required_report(uuid,date) TO service_role;
REVOKE ALL ON FUNCTION public.qa06_account_active() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.qa06_account_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa06_account_active() TO service_role;
ALTER TABLE public.mutabaah_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempt_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_family_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_entry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_day_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_day_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_report_grading ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_report_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_daily_notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_reminder_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_ramadan_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_promotion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_phone_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeroom_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutabaah_ramadan_activity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school_read" ON public.school_identity AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "school_admin" ON public.school_identity AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "profile_self_read" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "profile_admin" ON public.profiles AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "roles_self_read" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "roles_admin" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "year_read" ON public.academic_years AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "year_admin" ON public.academic_years AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "semester_read" ON public.semesters AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "semester_admin" ON public.semesters AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "classes_read" ON public.classes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes_admin" ON public.classes AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "students_read" ON public.students AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role('admin'::text) OR has_role('principal'::text) OR (EXISTS ( SELECT 1
   FROM student_guardians g
  WHERE ((g.student_id = students.id) AND (g.guardian_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM (student_enrollments e
     JOIN homeroom_assignments h ON ((h.class_id = e.class_id)))
  WHERE ((e.student_id = students.id) AND (h.teacher_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "students_admin" ON public.students AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "enrollments_read" ON public.student_enrollments AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role('admin'::text) OR has_role('principal'::text) OR (EXISTS ( SELECT 1
   FROM student_guardians g
  WHERE ((g.student_id = student_enrollments.student_id) AND (g.guardian_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM homeroom_assignments h
  WHERE ((h.class_id = student_enrollments.class_id) AND (h.teacher_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "enrollments_admin" ON public.student_enrollments AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "guardians_read" ON public.student_guardians AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role('admin'::text) OR (guardian_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "guardians_admin" ON public.student_guardians AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "homeroom_read" ON public.homeroom_assignments AS PERMISSIVE FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "homeroom_admin" ON public.homeroom_assignments AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "settings_read" ON public.app_settings AS PERMISSIVE FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "settings_admin" ON public.app_settings AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "school_assets_public_read" ON storage.objects AS PERMISSIVE FOR SELECT TO anon,authenticated USING ((bucket_id = 'school-assets'::text));
CREATE POLICY "school_assets_admin_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'school-assets'::text) AND has_role('admin'::text) AND (name ~~ 'logos/%'::text)));
CREATE POLICY "school_assets_admin_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'school-assets'::text) AND has_role('admin'::text) AND (name ~~ 'logos/%'::text))) WITH CHECK (((bucket_id = 'school-assets'::text) AND has_role('admin'::text) AND (name ~~ 'logos/%'::text)));
CREATE POLICY "school_assets_admin_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'school-assets'::text) AND has_role('admin'::text) AND (name ~~ 'logos/%'::text)));
CREATE POLICY "family_contacts_admin_select" ON public.student_family_contacts AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('admin'::text));
CREATE POLICY "family_contacts_admin_insert" ON public.student_family_contacts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role('admin'::text));
CREATE POLICY "family_contacts_admin_update" ON public.student_family_contacts AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "family_contacts_admin_delete" ON public.student_family_contacts AS PERMISSIVE FOR DELETE TO authenticated USING (has_role('admin'::text));
CREATE POLICY "parent_activation_admin_select" ON public.parent_activation_codes AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('admin'::text));
CREATE POLICY "mutabaah_activities_read" ON public.mutabaah_activities AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "mutabaah_activities_admin" ON public.mutabaah_activities AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "mutabaah_entries_read" ON public.mutabaah_entries AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role('admin'::text) OR (EXISTS ( SELECT 1
   FROM student_guardians g
  WHERE ((g.student_id = mutabaah_entries.student_id) AND (g.guardian_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "mutabaah_archives_read" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'mutabaah-report-archives'::text) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND mutabaah_can_read_report_class(((storage.foldername(name))[1])::uuid)));
CREATE POLICY "mutabaah_archives_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'mutabaah-report-archives'::text) AND (array_length(storage.foldername(name), 1) = 2) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND ((storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'::text) AND (storage.filename(name) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]docx$'::text) AND mutabaah_can_write_report_class(((storage.foldername(name))[1])::uuid) AND (EXISTS ( SELECT 1
   FROM (classes c
     JOIN semesters s ON ((s.academic_year_id = c.academic_year_id)))
  WHERE ((c.id = ((storage.foldername(objects.name))[1])::uuid) AND (s.id = ((storage.foldername(objects.name))[2])::uuid))))));
CREATE POLICY "mutabaah_archives_delete_authorized" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'mutabaah-report-archives'::text) AND mutabaah_can_delete_report_storage_object(name, owner_id)));
CREATE POLICY "ramadan_periods_admin" ON public.mutabaah_ramadan_periods AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "ramadan_links_admin" ON public.mutabaah_ramadan_activity_links AS PERMISSIVE FOR ALL TO authenticated USING (has_role('admin'::text)) WITH CHECK (has_role('admin'::text));
CREATE POLICY "parent_phone_change_own_read" ON public.parent_phone_change_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((guardian_id = auth.uid()));
CREATE POLICY "parent_phone_change_admin_read" ON public.parent_phone_change_requests AS PERMISSIVE FOR SELECT TO authenticated USING (has_role('admin'::text));
CREATE POLICY "qa06_active" ON public.students AS RESTRICTIVE FOR ALL TO authenticated USING (qa06_account_active()) WITH CHECK (qa06_account_active());
CREATE POLICY "qa06_active" ON public.student_enrollments AS RESTRICTIVE FOR ALL TO authenticated USING (qa06_account_active()) WITH CHECK (qa06_account_active());
CREATE POLICY "qa06_active" ON public.student_guardians AS RESTRICTIVE FOR ALL TO authenticated USING (qa06_account_active()) WITH CHECK (qa06_account_active());
CREATE POLICY "qa06_active" ON public.mutabaah_entries AS RESTRICTIVE FOR SELECT TO authenticated USING (qa06_account_active());

ALTER TABLE public.mutabaah_entry_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;
CREATE TRIGGER mutabaah_cleanup_exempt_answers_on_haid AFTER INSERT OR UPDATE OF is_haid ON public.mutabaah_day_conditions FOR EACH ROW EXECUTE FUNCTION mutabaah_cleanup_exempt_answers_on_haid();
CREATE TRIGGER mutabaah_entries_audit_change AFTER INSERT OR DELETE OR UPDATE ON public.mutabaah_entries FOR EACH ROW EXECUTE FUNCTION log_mutabaah_entry_change();
