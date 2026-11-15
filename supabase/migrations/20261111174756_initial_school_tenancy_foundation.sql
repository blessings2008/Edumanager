-- Initial school tenancy foundation.
-- Applied to the EduManager Supabase project as migration
-- 20261111174756_initial_school_tenancy_foundation.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  status text not null default 'active'
    check (status in ('active', 'disabled', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(email)),
  constraint users_email_unique unique (email)
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  country_code char(2) not null default 'MW',
  timezone text not null default 'Africa/Blantyre',
  status text not null default 'onboarding'
    check (status in ('onboarding', 'active', 'suspended', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$'),
  constraint schools_slug_unique unique (slug),
  constraint schools_id_unique_for_relations unique (id)
);

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  role text not null
    check (role in ('school_owner', 'school_admin', 'teacher', 'staff', 'student', 'guardian')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_memberships_school_user_unique unique (school_id, user_id),
  constraint school_memberships_id_school_unique unique (id, school_id)
);

create index school_memberships_user_status_idx
  on public.school_memberships (user_id, status);
create index school_memberships_school_role_status_idx
  on public.school_memberships (school_id, role, status);

create table public.school_domains (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  hostname text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'revoked')),
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint school_domains_hostname_lowercase check (hostname = lower(hostname)),
  constraint school_domains_hostname_format check (hostname ~ '^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$'),
  constraint school_domains_hostname_unique unique (hostname),
  constraint school_domains_id_school_unique unique (id, school_id)
);

create unique index school_domains_one_primary_per_school_idx
  on public.school_domains (school_id)
  where is_primary;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_school_created_idx
  on public.audit_events (school_id, created_at desc);
create index audit_events_actor_created_idx
  on public.audit_events (actor_user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();
create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();
create trigger school_memberships_set_updated_at
  before update on public.school_memberships
  for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.schools enable row level security;
alter table public.school_memberships enable row level security;
alter table public.school_domains enable row level security;
alter table public.audit_events enable row level security;

revoke all on table
  public.users,
  public.schools,
  public.school_memberships,
  public.school_domains,
  public.audit_events
from public, anon, authenticated;

grant all on table
  public.users,
  public.schools,
  public.school_memberships,
  public.school_domains,
  public.audit_events
to service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated;
