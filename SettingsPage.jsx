import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/auth.jsx';

export default function SettingsPage() {
  const { companyId } = useAuth();
  const [company, setCompany] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!companyId) return;
    supabase.from('companies').select('*').eq('id', companyId).single().then(({ data }) => setCompany(data));
    supabase.from('users').select('id, full_name, role, phone').eq('company_id', companyId).then(({ data }) => setUsers(data ?? []));
  }, [companyId]);

  const saveCompany = async () => {
    await supabase
      .from('companies')
      .update({
        name: company.name,
        default_calendar: company.default_calendar,
        weekend_days: company.weekend_days,
      })
      .eq('id', companyId);
  };

  if (!company) return <div className="p-6 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-100">Settings</h1>

      <section className="rounded-lg border border-slate-800 p-4 space-y-3">
        <h3 className="text-slate-300 font-medium text-sm">Company Profile</h3>
        <input
          value={company.name}
          onChange={(e) => setCompany({ ...company, name: e.target.value })}
          className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
        />
        <div className="flex gap-3 text-sm">
          <select
            value={company.default_calendar}
            onChange={(e) => setCompany({ ...company, default_calendar: e.target.value })}
            className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100"
          >
            <option value="gregorian">Gregorian</option>
            <option value="hijri">Hijri</option>
          </select>
          <select
            value={company.weekend_days}
            onChange={(e) => setCompany({ ...company, weekend_days: e.target.value })}
            className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100"
          >
            <option value="fri_sat">Fri–Sat weekend</option>
            <option value="sat_sun">Sat–Sun weekend</option>
          </select>
        </div>
        <button onClick={saveCompany} className="px-4 py-2 rounded bg-blue-700 text-white text-sm">
          Save
        </button>
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <h3 className="text-slate-300 font-medium text-sm mb-2">User Management</h3>
        <ul className="space-y-1 text-sm">
          {users.map((u) => (
            <li key={u.id} className="flex justify-between text-slate-300 border-b border-slate-900 py-1">
              <span>{u.full_name}</span>
              <span className="text-slate-500 capitalize">{u.role?.replace('_', ' ')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <h3 className="text-slate-300 font-medium text-sm mb-2">Subscription & Billing</h3>
        <p className="text-slate-400 text-sm capitalize">Plan: {company.subscription_plan}</p>
        <button className="mt-2 px-4 py-2 rounded bg-slate-800 text-slate-300 text-sm">
          Manage Billing (Moyasar) — TODO
        </button>
      </section>
    </div>
  );
}
