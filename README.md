# Meno — Consolidated Platform Repo

This is the assembled base platform (Sections 1–8 of the spec) with the
three extension modules (Live Location, Transport & Logistics, Financial
Intelligence) merged in as first-class features under `src/features/`.

## What's real vs. scaffolded

**Working end-to-end:** auth/login, RBAC via RLS, bilingual EN/AR with RTL
flip, dashboard widgets querying live data, resources table + worker profile
modal, project workspace with tabs, scheduling board with DB-enforced
conflict detection, documents/compliance grid, all three new modules wired
into routes and nav.

**Left as clearly marked TODOs** (called out in-file):
- QR code scanning (stubbed as a dropdown — swap in a library like `html5-qrcode`)
- File uploads (certs, project documents, permits) — needs Supabase Storage wiring
- PDF/Excel report generation and Compliance Pack merging
- Moyasar payment integration
- Map rendering in `LiveWorkerMap` / `TransportDashboard` (Mapbox/Google Maps slot ready)
- OneSignal push notifications
- Import from Excel for bulk worker/equipment upload

None of these were skipped by accident — each needs an external service
(Storage, a maps API key, a payment gateway) that only you can provision.

## 1. Provision Supabase

1. Create a project at supabase.com.
2. In the SQL editor, run migrations **in order**:
   - `supabase/migrations/001_core_schema.sql`
   - `supabase/migrations/002_location_transport_financial.sql`
3. Copy your project URL and anon key into `.env` (copy from `.env.example`).
4. Enable email/password auth in Supabase Auth settings.
5. Create your first company row and a matching `users` row linked to a
   real `auth.users` id (sign up once via the app, then backfill the `users`
   row with `company_id` + `role = 'ceo'` via the SQL editor) — there's no
   onboarding wizard yet, so the very first CEO account is seeded manually.

```sql
insert into companies (name) values ('Falcon Industrial Contracting') returning id;
-- then, after signing up once through the Login page:
insert into users (id, company_id, role, full_name)
values ('<auth.users.id from the signup>', '<company id above>', 'ceo', 'Your Name');
```

## 2. Run locally

```bash
npm install
cp .env.example .env   # fill in your Supabase URL/key
npm run dev
```

## 3. Deploy

- **Frontend:** push this repo to GitHub, connect to Vercel or Netlify,
  set the same two env vars in the hosting dashboard.
- **Edge functions:** `supabase functions deploy calculate-daily-costs` and
  `supabase functions deploy check-geofences`, then schedule both with
  `pg_cron` (SQL snippets are in `README_MODULES.md`... — see below).
- **PWA:** `vite-plugin-pwa` is already configured; add real icons at
  `public/icon-192.png` and `public/icon-512.png` before building.

## 4. Before a real pilot

- [ ] Replace the manual worker/equipment "select" stand-ins with actual QR scanning
- [ ] Wire Supabase Storage for cert/document/permit file uploads
- [ ] Add a Mapbox or Google Maps API key and render real pins
- [ ] Build the compliance-pack PDF generator (merge certs + project header)
- [ ] Set real `cost_rates` per trade/equipment type so financial widgets show real numbers
- [ ] Load-test the conflict-check triggers with concurrent assignment writes
- [ ] Review every RLS policy against your actual role/permission expectations before onboarding a real client

## Module integration notes

See `MODULES_README.md` (carried over from the earlier module scaffold) for
the detailed per-widget integration checklist for Location/Transport/Financial.
