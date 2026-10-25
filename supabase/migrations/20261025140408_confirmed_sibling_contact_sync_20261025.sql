-- Keep explicit sibling confirmation separate from phone numbers so family
-- contact synchronization continues when a guardian phone is absent/changed.
CREATE TABLE IF NOT EXISTS public.parent_sibling_consents (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sibling_student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  confirmed_by uuid NOT NULL REFERENCES public.profiles(user_id),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_sibling_consents_distinct_students CHECK (student_id <> sibling_student_id),
  CONSTRAINT parent_sibling_consents_pair_pk PRIMARY KEY (student_id, sibling_student_id)
);
CREATE INDEX IF NOT EXISTS parent_sibling_consents_sibling_idx
  ON public.parent_sibling_consents(sibling_student_id, student_id);
ALTER TABLE public.parent_sibling_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parent_sibling_consents FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.parent_sibling_consents TO service_role;

CREATE OR REPLACE FUNCTION public.sync_confirmed_sibling_contact_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_student_id uuid;
  v_relationship text;
  v_name text;
  v_phone text;
  v_family_ids uuid[];
BEGIN
  IF pg_catalog.pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
    v_relationship := OLD.relationship;
  ELSE
    v_student_id := NEW.student_id;
    v_relationship := NEW.relationship;
    v_name := NEW.full_name;
    v_phone := NEW.phone;
  END IF;

  WITH RECURSIVE family(student_id) AS (
    SELECT v_student_id
    UNION
    SELECT CASE
      WHEN c.student_id = f.student_id THEN c.sibling_student_id
      ELSE c.student_id
    END
    FROM public.parent_sibling_consents c
    JOIN family f
      ON c.student_id = f.student_id OR c.sibling_student_id = f.student_id
  )
  SELECT pg_catalog.array_agg(DISTINCT student_id)
    INTO v_family_ids FROM family;

  IF v_family_ids IS NULL OR pg_catalog.cardinality(v_family_ids) < 2 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.student_family_contacts fc
    WHERE fc.student_id = ANY(v_family_ids)
      AND fc.student_id <> v_student_id
      AND fc.relationship = v_relationship;
    RETURN OLD;
  END IF;

  INSERT INTO public.student_family_contacts
    (student_id, relationship, full_name, phone, updated_at)
  SELECT family_id, v_relationship, v_name, v_phone, now()
  FROM pg_catalog.unnest(v_family_ids) AS family_id
  WHERE family_id <> v_student_id
  ON CONFLICT (student_id, relationship) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        updated_at = now()
    WHERE public.student_family_contacts.full_name IS DISTINCT FROM EXCLUDED.full_name
       OR public.student_family_contacts.phone IS DISTINCT FROM EXCLUDED.phone;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_missing_contacts_on_sibling_confirmation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.student_family_contacts
    (student_id, relationship, full_name, phone, updated_at)
  SELECT target.student_id, source.relationship,
         source.full_name, source.phone, now()
  FROM (
    SELECT NEW.student_id AS student_id, NEW.sibling_student_id AS sibling_student_id
    UNION ALL
    SELECT NEW.sibling_student_id, NEW.student_id
  ) pair
  JOIN public.student_family_contacts source
    ON source.student_id = pair.sibling_student_id
  CROSS JOIN LATERAL (
    SELECT pair.student_id
  ) target
  ON CONFLICT (student_id, relationship) DO UPDATE
    SET full_name = CASE
          WHEN pg_catalog.btrim(coalesce(public.student_family_contacts.full_name, '')) = ''
          THEN EXCLUDED.full_name ELSE public.student_family_contacts.full_name END,
        phone = CASE
          WHEN public.student_family_contacts.phone IS NULL OR public.student_family_contacts.phone = ''
          THEN EXCLUDED.phone ELSE public.student_family_contacts.phone END,
        updated_at = CASE
          WHEN (pg_catalog.btrim(coalesce(public.student_family_contacts.full_name, '')) = ''
                AND EXCLUDED.full_name IS NOT NULL)
            OR (public.student_family_contacts.phone IS NULL OR public.student_family_contacts.phone = '')
          THEN now() ELSE public.student_family_contacts.updated_at END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.capture_confirmed_sibling_pair()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_first uuid;
  v_second uuid;
BEGIN
  IF NEW.student_id = NEW.matched_student_id THEN RETURN NEW; END IF;
  IF NEW.student_id < NEW.matched_student_id THEN
    v_first := NEW.student_id;
    v_second := NEW.matched_student_id;
  ELSE
    v_first := NEW.matched_student_id;
    v_second := NEW.student_id;
  END IF;

  INSERT INTO public.parent_sibling_consents(student_id, sibling_student_id, confirmed_by)
  VALUES (v_first, v_second, NEW.confirmed_by)
  ON CONFLICT (student_id, sibling_student_id) DO UPDATE
    SET confirmed_by = EXCLUDED.confirmed_by,
        confirmed_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_confirmed_sibling_contact_change ON public.student_family_contacts;
CREATE TRIGGER sync_confirmed_sibling_contact_change
AFTER INSERT OR UPDATE OR DELETE ON public.student_family_contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_confirmed_sibling_contact_change();

DROP TRIGGER IF EXISTS sync_missing_contacts_on_sibling_confirmation ON public.parent_sibling_consents;
CREATE TRIGGER sync_missing_contacts_on_sibling_confirmation
AFTER INSERT ON public.parent_sibling_consents
FOR EACH ROW EXECUTE FUNCTION public.sync_missing_contacts_on_sibling_confirmation();

DROP TRIGGER IF EXISTS capture_confirmed_sibling_pair ON public.parent_family_consents;
CREATE TRIGGER capture_confirmed_sibling_pair
AFTER INSERT OR UPDATE ON public.parent_family_consents
FOR EACH ROW EXECUTE FUNCTION public.capture_confirmed_sibling_pair();

REVOKE ALL ON FUNCTION public.sync_confirmed_sibling_contact_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_missing_contacts_on_sibling_confirmation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_confirmed_sibling_pair() FROM PUBLIC, anon, authenticated;

-- Preserve previously confirmed sibling relationships even if the shared
-- contact phone is changed later and phone-specific approval is invalidated.
INSERT INTO public.parent_sibling_consents(student_id, sibling_student_id, confirmed_by)
SELECT DISTINCT
  CASE WHEN c.student_id < c.matched_student_id THEN c.student_id ELSE c.matched_student_id END,
  CASE WHEN c.student_id < c.matched_student_id THEN c.matched_student_id ELSE c.student_id END,
  c.confirmed_by
FROM public.parent_family_consents c
WHERE c.student_id <> c.matched_student_id
ON CONFLICT (student_id, sibling_student_id) DO NOTHING;
