# Meno — Part A/B/C Module Scaffold

This package adds **Live Worker Location Tracking**, **Heavy Machine Transport
Management**, and **Daily Financial Intelligence** on top of the existing
Meno React/Vite + Supabase codebase.

## What's here

```
migrations/002_location_transport_financial.sql   All new tables, enums, RLS
src/features/location/    locationService.js, LiveWorkerMap.jsx, WorkerLocationShare.jsx
src/features/transport/   transportService.js, TransportDashboard.jsx, TransportPlanningBoard.jsx
src/features/financial/   financialService.js, FinancialDashboard.jsx
supabase/functions/       calculate-daily-costs (nightly cost rollup)
                           check-geofences (5-min geofence check + 30-day log sweep)
```

## Before you run the migration

The SQL assumes these already exist in your schema (rename in the migration
file if they don't match):
- `auth_company_id()` / `auth_role()` helper functions used by existing RLS policies
- Tables: `companies`, `workers`, `equipment`, `projects`, `assignments`, `trades`, `equipment_types`, `notifications`, `users`

## Integration checklist

**Dashboard (Section 1)**
- Add `<LiveWorkerMap />` to the CEO/OpsManager widget grid, gated by role.
- Replace the old idle-equipment card with a "Daily Operating Cost" card
  reading `companies.idle_equipment_cost_today` + `fetchTodaySpend()`.
- "Upcoming Shortages" widget: extend its query to also pull rows from
  `delay_cost_logs` and pending `transport_requests` targeting a project
  starting soon, so transport delays show up as shortage alerts.

**Navigation**
- Add "Transport & Logistics" (CEO, OpsManager) → `TransportDashboard` / `TransportPlanningBoard`.
- Add "Financial Overview" (CEO, optionally OpsManager) → `FinancialDashboard`.

**Scheduling Board (Section 4)**
- Resource Pool: add a third tab "Transport" alongside Manpower/Equipment,
  fed by `fetchTransportFleet()`. Transport items drag onto `TransportRequest`
  rows on the Transport Planning Board, not onto Project rows.
- While dragging any resource, call `estimateAssignmentCost()` and show the
  result in the drag tooltip/sidebar.

**Project Workspace (Section 3)**
- New "Financials" tab: daily cost chart/table for the project (filter
  `daily_project_costs` by `project_id`), budget progress bar from
  `project_budget_summary`, manual cost entry, and the project's rows from
  `delay_cost_logs`.

**Mobile Foreman/Worker PWA (Section 7)**
- Add `<WorkerLocationShare mode="self" />` for workers/foremen once they
  consent on first use (store consent flag on the worker record if not
  already present).
- Foreman "Today's Crew" view: add `<WorkerLocationShare mode="report" />`
  per crew member for manual location reporting.
- Driver view (reuse Foreman role or add a `driver` role): buttons for
  "Start Transport" / "Reach Checkpoint" / "Arrive Destination" call
  `logCheckpoint()`; "Report Delay" calls `reportDelay()`.

**Scheduled jobs (pg_cron)**
```sql
-- Nightly financial rollup, 2 AM
select cron.schedule('daily-cost-rollup', '0 2 * * *',
  $$ select net.http_post(url := '<calculate-daily-costs function URL>') $$);

-- Geofence + archive sweep, every 5 minutes
select cron.schedule('geofence-check', '*/5 * * * *',
  $$ select net.http_post(url := '<check-geofences function URL>') $$);
```

## Bilingual strings to add

English / Arabic pairs needed in your i18n option set (keys used above):
`widget.liveWorkerMap`, `widget.offSiteAlert`, `widget.onSiteNow`,
`mobile.startSharing`, `mobile.stopSharing`, `mobile.reportWorkerLocation`,
`nav.transport`, `nav.financial`, `transport.requestTransport`,
`transport.activeTransports`, `transport.inTransit`, `transport.delayed`,
`transport.status.pending|assigned|in_transit|delivered`, `transport.urgent`,
`transport.fleetPool`, `transport.dropVehicleHint`, `transport.yard`,
`financial.todaySpend`, `financial.monthToDate`, `financial.idleAssetsCosting`,
`financial.delayAlerts`, `financial.mtdProjectCosts`, `financial.budget`,
`financial.actual`. All should flip RTL automatically via the existing `dir`
handling — no new layout logic needed since these components read `dir` from
your existing `useTranslation()` hook.

## Known scaffold limitations (by design, given "high-level" scope)

- Map rendering is a placeholder `<div>` slot — wire in Mapbox GL/Google Maps
  using the `visible`/`requests` arrays already shaped for pin rendering.
- Transport Planning Board drag-and-drop is native HTML5 DnD for simplicity;
  swap for your existing scheduling-board DnD library for visual consistency.
- Driver assignment on the Transport Planning Board picks `drivers[0]` as a
  placeholder — replace with the driver picker modal.
- Cost estimates default to 0 lookup for equipment (`equipment.daily_cost`
  override checked first, falls back to `cost_rates`); confirm this matches
  your existing idle-equipment-cost field name.
