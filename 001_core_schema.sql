-- ============================================================================
-- Meno Platform — Migration 001: Core Schema
-- Companies, users, workers, equipment, projects, assignments, certifications,
-- resource requests, check-in/out, notifications, report templates, option sets.
-- Run this BEFORE 002_location_transport_financial.sql.
-- ============================================================================

begin;

create extension if not exists pgcrypto;
create extension if not exists postgis; -- used loosely; lat/lng stored as numeric, not geography, for simplicity

-- ---------------------------------------------------------------------------
-- Enums / option sets
-- ---------------------------------------------------------------------------
create type user_role as enum ('ceo', 'ops_manager', 'project_manager', 'foreman');
create type calendar_type as enum ('gregorian', 'hijri');
create type weekend_days as enum ('fri_sat', 'sat_sun');
create type worker_status as enum ('available', 'assigned', 'on_leave', 'in_training');
create type equipment_status as enum ('available', 'assigned', 'under_maintenance', 'in_transit');
create type equipment_ownership as enum ('owned', 'rented');
create type project_status as enum ('active', 'completed', 'on_hold');
create type cert_status as enum ('valid', 'expiring', 'expired');
create type subscription_plan as enum ('starter', 'professional', 'enterprise');

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  subscription_plan subscription_plan not null default 'starter',
  default_calendar calendar_type not null default 'gregorian',
  weekend_days weekend_days not null default 'fri_sat',
  default_language text not null default 'en', -- 'en' | 'ar'
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Users (extends Supabase auth.users via a profile row)
-- ---------------------------------------------------------------------------
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id),
  role user_role not null default 'foreman',
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- Helper functions used throughout RLS policies (referenced by 002 migration too)
create or replace function auth_company_id() returns uuid as $$
  select company_id from users where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_role() returns user_role as $$
  select role from users where id = auth.uid();
$$ language sql stable security definer;

-- ---------------------------------------------------------------------------
-- Option sets: trades, equipment types, cert types (bilingual display names)
-- ---------------------------------------------------------------------------
create table trades (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id), -- null = global default set
  name_en text not null,
  name_ar text not null
);

create table equipment_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  name_en text not null,
  name_ar text not null,
  is_transport boolean not null default false -- set true for Lowbed/Flatbed/Escort Car
);

create table cert_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  name_en text not null,
  name_ar text not null,
  applies_to text not null default 'worker' check (applies_to in ('worker', 'equipment', 'both'))
);

-- ---------------------------------------------------------------------------
-- Workers
-- ---------------------------------------------------------------------------
create table workers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  photo_url text,
  iqama_number text not null,
  iqama_expiry date,
  trade_id uuid references trades(id),
  nationality text,
  mobile text,
  emergency_contact text,
  current_status worker_status not null default 'available',
  qr_code text, -- generated on insert (worker id encoded)
  location_tracking_enabled boolean not null default true, -- (added again here for standalone runs; 002 uses IF NOT EXISTS)
  location_consent_given boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, iqama_number)
);

-- ---------------------------------------------------------------------------
-- Equipment
-- ---------------------------------------------------------------------------
create table equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  photo_url text,
  equipment_type_id uuid references equipment_types(id),
  serial_number text,
  capacity text,
  year int,
  ownership equipment_ownership not null default 'owned',
  current_status equipment_status not null default 'available',
  daily_cost numeric(10,2), -- used by idle-equipment cost widget and rollups
  qr_code text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  client_name text,
  start_date date not null,
  end_date date,
  status project_status not null default 'active',
  project_manager_id uuid references users(id),
  resource_slots_manpower int not null default 0,
  resource_slots_equipment int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Assignments (worker OR equipment, never both null)
-- ---------------------------------------------------------------------------
create table assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  worker_id uuid references workers(id),
  equipment_id uuid references equipment(id),
  project_id uuid not null references projects(id),
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint chk_worker_or_equipment check (
    (worker_id is not null and equipment_id is null) or
    (worker_id is null and equipment_id is not null)
  ),
  constraint chk_dates check (end_date >= start_date)
);

create index idx_assignments_worker_dates on assignments (worker_id, start_date, end_date);
create index idx_assignments_equipment_dates on assignments (equipment_id, start_date, end_date);
create index idx_assignments_project on assignments (project_id);

-- Conflict guard: no overlapping assignment for the same worker or equipment
create or replace function check_assignment_conflict() returns trigger as $$
begin
  if NEW.worker_id is not null and exists (
    select 1 from assignments a
    where a.id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and a.worker_id = NEW.worker_id
      and daterange(a.start_date, a.end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) then
    raise exception 'Worker already assigned during this date range';
  end if;

  if NEW.equipment_id is not null and exists (
    select 1 from assignments a
    where a.id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and a.equipment_id = NEW.equipment_id
      and daterange(a.start_date, a.end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) then
    raise exception 'Equipment already assigned during this date range';
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger trg_assignment_conflict
  before insert or update on assignments
  for each row execute function check_assignment_conflict();

-- Keep worker/equipment current_status in sync with assignments
create or replace function sync_resource_status() returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.worker_id is not null then
      update workers set current_status = 'assigned' where id = NEW.worker_id;
    end if;
    if NEW.equipment_id is not null then
      update equipment set current_status = 'assigned' where id = NEW.equipment_id;
    end if;
  elsif TG_OP = 'DELETE' then
    if OLD.worker_id is not null then
      update workers set current_status = 'available' where id = OLD.worker_id;
    end if;
    if OLD.equipment_id is not null then
      update equipment set current_status = 'available' where id = OLD.equipment_id;
    end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

create trigger trg_sync_resource_status
  after insert or delete on assignments
  for each row execute function sync_resource_status();

-- ---------------------------------------------------------------------------
-- Certifications
-- ---------------------------------------------------------------------------
create table certifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  worker_id uuid references workers(id),
  equipment_id uuid references equipment(id),
  cert_type_id uuid not null references cert_types(id),
  issue_date date,
  expiry_date date not null,
  document_url text,
  created_at timestamptz not null default now(),
  constraint chk_cert_holder check (
    (worker_id is not null and equipment_id is null) or
    (worker_id is null and equipment_id is not null)
  )
);

create index idx_certifications_expiry on certifications (expiry_date);

-- Computed status via view (avoids stale stored status)
create or replace view certifications_with_status as
  select *,
    case
      when expiry_date < current_date then 'expired'
      when expiry_date <= current_date + interval '30 days' then 'expiring'
      else 'valid'
    end::cert_status as status
  from certifications;

-- ---------------------------------------------------------------------------
-- Resource requests, check-in/out, notifications, report templates
-- ---------------------------------------------------------------------------
create table resource_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  project_id uuid not null references projects(id),
  requested_by uuid references users(id),
  trade_id uuid references trades(id),
  equipment_type_id uuid references equipment_types(id),
  quantity int not null default 1,
  start_date date not null,
  end_date date not null,
  fulfilled boolean not null default false,
  created_at timestamptz not null default now()
);

create table checkinout (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  worker_id uuid not null references workers(id),
  project_id uuid not null references projects(id),
  date date not null default current_date,
  time_in timestamptz,
  time_out timestamptz,
  foreman_id uuid references users(id),
  location text
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  message text not null,
  link_url text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table report_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id),
  name text not null,
  client_type text, -- e.g. 'Aramco', 'SABIC'
  include_fields text[]
);

-- ---------------------------------------------------------------------------
-- Row Level Security — company-scoped for all tenant tables
-- ---------------------------------------------------------------------------
alter table users enable row level security;
alter table workers enable row level security;
alter table equipment enable row level security;
alter table projects enable row level security;
alter table assignments enable row level security;
alter table certifications enable row level security;
alter table resource_requests enable row level security;
alter table checkinout enable row level security;
alter table notifications enable row level security;
alter table report_templates enable row level security;
alter table trades enable row level security;
alter table equipment_types enable row level security;
alter table cert_types enable row level security;

create policy users_self_company on users
  for select using (company_id = auth_company_id());

create policy workers_company_scope on workers
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy equipment_company_scope on equipment
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

-- Projects: CEO/OpsManager see all; PM sees only assigned projects; Foreman sees
-- only projects they have a current assignment/check-in against.
create policy projects_scope on projects
  for select using (
    company_id = auth_company_id()
    and (
      auth_role() in ('ceo', 'ops_manager')
      or (auth_role() = 'project_manager' and project_manager_id = auth.uid())
      or (auth_role() = 'foreman' and exists (
            select 1 from checkinout c where c.project_id = projects.id and c.foreman_id = auth.uid()
          ))
    )
  );

create policy projects_write_managers on projects
  for insert with check (company_id = auth_company_id() and auth_role() in ('ceo', 'ops_manager'));

create policy projects_update_managers on projects
  for update using (company_id = auth_company_id() and auth_role() in ('ceo', 'ops_manager'));

create policy assignments_company_scope on assignments
  for select using (company_id = auth_company_id());

create policy assignments_write_ops on assignments
  for insert with check (company_id = auth_company_id() and auth_role() in ('ceo', 'ops_manager'));

create policy assignments_update_ops on assignments
  for update using (company_id = auth_company_id() and auth_role() in ('ceo', 'ops_manager'));

create policy assignments_delete_ops on assignments
  for delete using (company_id = auth_company_id() and auth_role() in ('ceo', 'ops_manager'));

create policy certifications_company_scope on certifications
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy resource_requests_scope on resource_requests
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy checkinout_scope on checkinout
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy notifications_own on notifications
  for all using (user_id = auth.uid());

create policy report_templates_scope on report_templates
  for all using (company_id = auth_company_id() or company_id is null);

create policy trades_scope on trades
  for select using (company_id = auth_company_id() or company_id is null);

create policy equipment_types_scope on equipment_types
  for select using (company_id = auth_company_id() or company_id is null);

create policy cert_types_scope on cert_types
  for select using (company_id = auth_company_id() or company_id is null);

commit;
