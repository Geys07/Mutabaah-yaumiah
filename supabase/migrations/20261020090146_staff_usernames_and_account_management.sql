-- Production migration: 20261020090146_staff_usernames_and_account_management
-- The corresponding migration has ALREADY been applied to production.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_staff_username_format_check
  CHECK (username IS NULL OR (username ~ '^[a-z][a-z0-9._-]{3,23}$' AND username <> 'admin'));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_staff_username_unique
  ON public.profiles(username);

CREATE OR REPLACE FUNCTION public.manage_staff_account(p_user_id uuid, p_full_name text, p_username text, p_phone text, p_active boolean, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_name text; v_username text; v_phone text;
BEGIN
  IF NOT public.has_role('admin') OR NOT public.qa06_account_active() THEN
    RAISE EXCEPTION 'Akses ditolak' USING ERRCODE='42501';
  END IF;
  IF p_role NOT IN ('homeroom_teacher','principal') OR p_role IS NULL THEN
    RAISE EXCEPTION 'Peran tidak valid' USING ERRCODE='22023';
  END IF;
  IF p_user_id IS NULL OR p_user_id=(SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Akun tidak valid' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_roles
                WHERE user_id=p_user_id AND role=p_role)
     OR EXISTS(SELECT 1 FROM public.user_roles
                WHERE user_id=p_user_id AND role<>p_role) THEN
    RAISE EXCEPTION 'Peran akun tidak sesuai' USING ERRCODE='42501';
  END IF;
  v_name:=pg_catalog.btrim(pg_catalog.regexp_replace(COALESCE(p_full_name,''),'\\s+',' ','g'));
  v_username:=pg_catalog.lower(pg_catalog.btrim(COALESCE(p_username,'')));
  v_phone:=NULLIF(pg_catalog.btrim(COALESCE(p_phone,'')),'');
  IF pg_catalog.length(v_name) < 2 OR pg_catalog.length(v_name)>150 THEN
    RAISE EXCEPTION 'Nama tidak valid' USING ERRCODE='22023';
  END IF;
  IF v_username !~ '^[a-z][a-z0-9._-]{3,23}$' OR v_username='admin' THEN
    RAISE EXCEPTION 'Nama pengguna harus 4–24 karakter huruf kecil, angka, titik, garis bawah, atau strip; bukan admin' USING ERRCODE='22023';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^08[0-9]{8,11}$' THEN
    RAISE EXCEPTION 'Nomor HP tidak valid' USING ERRCODE='22023';
  END IF;
  UPDATE public.profiles
  SET full_name=v_name, username=v_username, phone=v_phone,
      account_status=CASE WHEN p_active THEN 'active' ELSE 'disabled' END,
      updated_at=now()
  WHERE user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Akun belum terdaftar' USING ERRCODE='22023'; END IF;
END $function$
;
REVOKE ALL ON FUNCTION public.manage_staff_account(uuid,text,text,text,boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manage_staff_account(uuid,text,text,text,boolean,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.manage_staff_account(uuid,text,text,text,boolean,text) TO authenticated;
