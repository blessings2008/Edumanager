-- Align the first Supabase schema with the shared TypeScript identity contracts.
-- Repository change only: review this migration before applying it to Supabase.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_status_check;

UPDATE public.schools
SET status = 'provisioning'
WHERE status = 'onboarding';

ALTER TABLE public.schools
  ADD CONSTRAINT schools_status_check
  CHECK (status IN ('provisioning', 'active', 'suspended', 'archived'));

ALTER TABLE public.school_memberships
  DROP CONSTRAINT IF EXISTS school_memberships_role_check;

UPDATE public.school_memberships
SET role = 'school_staff'
WHERE role = 'staff';

ALTER TABLE public.school_memberships
  ADD CONSTRAINT school_memberships_role_check
  CHECK (role IN ('school_owner', 'school_admin', 'school_staff', 'teacher', 'student', 'guardian'));

ALTER TABLE public.school_memberships
  DROP CONSTRAINT IF EXISTS school_memberships_status_check;

ALTER TABLE public.school_memberships
  ADD CONSTRAINT school_memberships_status_check
  CHECK (status IN ('invited', 'active', 'suspended', 'revoked'));

-- The initial schema has no domain-kind field. Refuse to guess the kind of
-- existing hostnames; classify them explicitly before applying if any exist.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM public.school_domains) THEN
    RAISE EXCEPTION
      'Cannot infer school_domains.kind for existing rows; classify each hostname before applying this migration.';
  END IF;
END;
$migration$;

ALTER TABLE public.school_domains
  ADD COLUMN kind text NOT NULL
  CONSTRAINT school_domains_kind_check
  CHECK (kind IN ('platform_subdomain', 'custom'));
