-- ============================================================================
-- Meno Platform — Migration 002
-- Adds: (A) Live Worker Location Tracking, (B) Heavy Machine Transport
--       Management, (C) Daily Financial Intelligence
--
-- ASSUMPTIONS (adjust to match your actual schema if names differ):
--   - A helper function `auth_company_id()` returns the calling user's
--     company_id (as used in existing RLS policies on workers/equipment).
--   - A helper function `auth_role()` returns one of:
--     'ceo' | 'ops_manager' | 'project_manager' | 'foreman'.
--   - Existing tables: companies, workers, equipment, projects, assignments,
--     trades (option set), equipment_types (option set), notifications.
--   - Existing `equipment` table has: id, company_id, name, equipment_type_id,
--     current_status, daily_cost (nullable numeric already used by the idle
--     equipment widget).
-- If any of these differ, rename references below before running.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- PART A: LIVE WORKER LOCATION TRACKING
-- ----------------------------------------------------------------------------

alter table workers
  add column if not exists location_tracking_enabled boolean not null default true;

alter table companies
  add column if not exists gps_collection_interval_minutes int not null default 5,
  add column if not exists geofence_radius_meters int not null default 200;

-- Project site geofence center (lat/lng of the plant/site)
alter table projects
  add column if not exists site_latitude numeric(9,6),
  add column if not exists site_longitude numeric(9,6);

create type location_source as enum ('gps_auto', 'qr_checkin', 'manual');

create table if not exists worker_location_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  worker_id uuid not null references workers(id),
  project_id uuid references projects(id), -- derived from active assignment at time of log
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  accuracy numeric(6,2),
  recorded_by uuid references auth.users(id), -- null when GPS_Auto
  source location_source not null default 'gps_auto',
  is_within_geofence boolean, -- computed at insert time by check-geofences function or trigger
  created_at timestamptz not null default now()
);

create index if not exists idx_wll_worker_time on worker_location_logs (worker_id, created_at desc);
create index if not exists idx_wll_company_time on worker_location_logs (company_id, created_at desc);

-- Auto-archive: locations older than 30 days are pruned by a scheduled job
-- (see supabase/functions/check-geofences for the companion sweep call).

alter table worker_location_logs enable row level security;

-- Only CEO / Ops Manager can read the live map; workers can insert their own pings.
create policy wll_select_managers on worker_location_logs
  for select using (
    company_id = auth_company_id()
    and auth_role() in ('ceo', 'ops_manager')
  );

create policy wll_insert_self_or_foreman on worker_location_logs
  for insert with check (
    company_id = auth_company_id()
  );

-- ----------------------------------------------------------------------------
-- PART B: HEAVY MACHINE TRANSPORTATION MANAGEMENT
-- ----------------------------------------------------------------------------

create type transport_status as enum ('pending', 'assigned', 'in_transit', 'delivered');
create type transport_priority as enum ('normal', 'urgent');
create type checkpoint_status as enum ('departed', 'in_transit', 'arrived_at_checkpoint', 'delayed', 'delivered');

-- Transport-capable vehicles are stored as `equipment` rows with
-- equipment_type = 'lowbed' | 'flatbed' | 'escort_car' (added to the
-- EquipmentType option set). We extend equipment with transport-specific
-- fields rather than duplicating the table.
alter table equipment
  add column if not exists plate_number text,
  add column if not exists capacity_ton numeric(8,2);

-- Marks which EquipmentType option-set rows represent transport vehicles
-- (Lowbed, Flatbed, Escort Car) so the fleet picker can filter on it.
alter table equipment_types
  add column if not exists is_transport boolean not null default false;

create table if not exists transport_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  source_project_id uuid references projects(id), -- null = yard
  destination_project_id uuid not null references projects(id),
  equipment_to_move_id uuid not null references equipment(id),
  desired_pickup_date date not null,
  desired_delivery_date date not null,
  status transport_status not null default 'pending',
  required_permits text[],
  priority transport_priority not null default 'normal',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists transport_assignments (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references transport_requests(id) on delete cascade,
  transport_vehicle_id uuid not null references equipment(id), -- the lowbed/flatbed
  driver_id uuid not null references workers(id),
  escort_worker_id uuid references workers(id),
  actual_pickup_time timestamptz,
  actual_delivery_time timestamptz,
  notes text,
  permit_document_url text,
  created_at timestamptz not null default now(),
  -- prevent same vehicle or driver double-booked across overlapping requests
  constraint chk_pickup_before_delivery check (
    actual_delivery_time is null or actual_pickup_time is null
    or actual_delivery_time >= actual_pickup_time
  )
);

create table if not exists transit_checkpoints (
  id uuid primary key default gen_random_uuid(),
  transport_assignment_id uuid not null references transport_assignments(id) on delete cascade,
  latitude numeric(9,6),
  longitude numeric(9,6),
  status checkpoint_status not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists permits (
  id uuid primary key default gen_random_uuid(),
  permit_number text not null,
  transport_request_id uuid not null references transport_requests(id) on delete cascade,
  issue_date date,
  expiry_date date,
  file_url text,
  authority text,
  created_at timestamptz not null default now()
);

-- Conflict guard: a driver or transport vehicle cannot have two overlapping
-- in-progress assignments. Enforced via trigger (exclusion constraints on
-- date ranges need actual/expected windows; using a trigger keeps it simple
-- given pickup/delivery times are nullable until confirmed).
create or replace function check_transport_conflict() returns trigger as $$
begin
  if exists (
    select 1 from transport_assignments ta
    join transport_requests tr on tr.id = ta.transport_request_id
    join transport_requests new_tr on new_tr.id = NEW.transport_request_id
    where ta.id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (ta.driver_id = NEW.driver_id or ta.transport_vehicle_id = NEW.transport_vehicle_id)
      and tr.status in ('assigned', 'in_transit')
      and daterange(tr.desired_pickup_date, tr.desired_delivery_date, '[]')
          && daterange(new_tr.desired_pickup_date, new_tr.desired_delivery_date, '[]')
  ) then
    raise exception 'Driver or transport vehicle already assigned in this window';
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_transport_conflict on transport_assignments;
create trigger trg_transport_conflict
  before insert or update on transport_assignments
  for each row execute function check_transport_conflict();

alter table transport_requests enable row level security;
alter table transport_assignments enable row level security;
alter table transit_checkpoints enable row level security;
alter table permits enable row level security;

create policy tr_company_scope on transport_requests
  for all using (company_id = auth_company_id())
  with check (company_id = auth_company_id());

create policy ta_via_request on transport_assignments
  for all using (
    exists (select 1 from transport_requests tr
            where tr.id = transport_assignments.transport_request_id
            and tr.company_id = auth_company_id())
  );

create policy tc_via_assignment on transit_checkpoints
  for all using (
    exists (select 1 from transport_assignments ta
            join transport_requests tr on tr.id = ta.transport_request_id
            where ta.id = transit_checkpoints.transport_assignment_id
            and tr.company_id = auth_company_id())
  );

create policy permit_via_request on permits
  for all using (
    exists (select 1 from transport_requests tr
            where tr.id = permits.transport_request_id
            and tr.company_id = auth_company_id())
  );

-- ----------------------------------------------------------------------------
-- PART C: DAILY FINANCIAL INTELLIGENCE
-- ----------------------------------------------------------------------------

create type cost_entity_type as enum ('manpower', 'equipment');
create type rate_type as enum ('hourly', 'daily', 'monthly');
create type budget_type as enum ('total', 'monthly', 'weekly');

create table if not exists cost_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  entity_type cost_entity_type not null,
  trade_id uuid references trades(id),          -- for manpower rates
  equipment_type_id uuid references equipment_types(id), -- for equipment rates
  rate_type rate_type not null default 'daily',
  amount numeric(10,2) not null,
  overtime_multiplier numeric(4,2) not null default 1.5,
  effective_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists worker_cost_overrides (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references workers(id) unique,
  cost_rate_id uuid not null references cost_rates(id)
);

create table if not exists daily_project_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  project_id uuid not null references projects(id),
  date date not null,
  manpower_cost numeric(12,2) not null default 0,
  equipment_cost numeric(12,2) not null default 0,
  transport_cost numeric(12,2) not null default 0,
  delayed_resource_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) generated always as
    (manpower_cost + equipment_cost + transport_cost + delayed_resource_cost) stored,
  created_at timestamptz not null default now(),
  unique (project_id, date)
);

create index if not exists idx_dpc_company_date on daily_project_costs (company_id, date desc);

create table if not exists project_budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) unique,
  budget_amount numeric(12,2) not null,
  budget_type budget_type not null default 'total',
  cost_threshold_alert_pct int not null default 80
);

-- Cached aggregate for fast dashboard reads (updated nightly by the
-- calculate-daily-costs edge function), per the spec's caching guidance.
alter table companies
  add column if not exists idle_equipment_cost_today numeric(12,2) not null default 0;

create table if not exists delay_cost_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  project_id uuid not null references projects(id),
  date date not null default current_date,
  reason text not null,
  affected_equipment_id uuid references equipment(id),
  cost_impact numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table cost_rates enable row level security;
alter table worker_cost_overrides enable row level security;
alter table daily_project_costs enable row level security;
alter table project_budgets enable row level security;
alter table delay_cost_logs enable row level security;

-- Cost data is confidential: CEO + Ops Manager only. PMs get budget-vs-actual
-- totals only, exposed through a restricted view (below), never this table directly.
create policy cost_rates_managers_only on cost_rates
  for all using (company_id = auth_company_id() and auth_role() in ('ceo', 'ops_manager'));

create policy wco_managers_only on worker_cost_overrides
  for all using (
    auth_role() in ('ceo', 'ops_manager')
    and exists (select 1 from workers w where w.id = worker_cost_overrides.worker_id and w.company_id = auth_company_id())
  );

create policy dpc_managers_only on daily_project_costs
  for select using (company_id = auth_company_id() and auth_role() in ('ceo', 'ops_manager'));

create policy budgets_read_scoped on project_budgets
  for select using (
    exists (
      select 1 from projects p
      where p.id = project_budgets.project_id
      and p.company_id = auth_company_id()
      and (auth_role() in ('ceo', 'ops_manager')
           or (auth_role() = 'project_manager' and p.project_manager_id = auth.uid()))
    )
  );

create policy budgets_write_managers on project_budgets
  for insert with check (auth_role() in ('ceo', 'ops_manager'));

create policy delay_logs_managers_and_pm on delay_cost_logs
  for select using (
    company_id = auth_company_id()
    and (auth_role() in ('ceo', 'ops_manager')
         or (auth_role() = 'project_manager'
             and exists (select 1 from projects p where p.id = delay_cost_logs.project_id and p.project_manager_id = auth.uid())))
  );

-- PM-safe view: budget vs actual only, no line-item rates exposed.
create or replace view project_budget_summary as
  select
    p.id as project_id,
    p.name as project_name,
    pb.budget_amount,
    pb.budget_type,
    coalesce(sum(dpc.total_cost), 0) as actual_to_date,
    case when pb.budget_amount > 0
      then round(coalesce(sum(dpc.total_cost), 0) / pb.budget_amount * 100, 1)
      else 0 end as pct_spent
  from projects p
  join project_budgets pb on pb.project_id = p.id
  left join daily_project_costs dpc on dpc.project_id = p.id
  group by p.id, p.name, pb.budget_amount, pb.budget_type;

commit;
