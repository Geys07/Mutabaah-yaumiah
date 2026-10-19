-- LOCAL ONLY. auth.users here is a minimal fixture table, not Supabase Auth.
DO $$ BEGIN IF current_database()<>'qa06_fixture' OR current_setting('port')<>'55436' THEN RAISE EXCEPTION 'LOCAL FIXTURE ONLY'; END IF; END $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claim.role',true)$$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
ALTER TABLE profiles ADD COLUMN phone text UNIQUE,ADD COLUMN full_name text,ADD COLUMN updated_at timestamptz;
ALTER TABLE user_roles ADD UNIQUE(user_id,role);
ALTER TABLE student_guardians ADD COLUMN relationship text;
CREATE TABLE student_family_contacts(student_id uuid,relationship text,phone text,full_name text);
CREATE TABLE parent_activation_codes(id uuid PRIMARY KEY,student_id uuid,relationship text,phone text,code text,used_at timestamptz,expires_at timestamptz);
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
REVOKE ALL ON FUNCTION complete_parent_activation(text,text,uuid,text) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION complete_parent_activation(text,text,uuid,text) TO service_role;
