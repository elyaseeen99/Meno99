import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth.jsx';
import { useTranslation } from '../lib/i18n.jsx';
import RoleGate from '../components/layout/RoleGate.jsx';
import LiveWorkerMap from '../features/location/LiveWorkerMap.jsx';

const STATUS_COLORS = { available: '#22c55e', assigned: '#3b82f6', on_leave: '#f59e0b', under_maintenance: '#ef4444', in_transit: '#a855f7' };

export default function Dashboard() {
  const { companyId, role } = useAuth();
  const { t } = useTranslation();
  const [workerBreakdown, setWorkerBreakdown] = useState([]);
  const [equipmentBreakdown, setEquipmentBreakdown] = useState([]);
  const [expiringCerts, setExpiringCerts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState('manpower');

  useEffect(() => {
    if (!companyId) return;

    supabase
      .from('workers')
      .select('current_status')
      .eq('company_id', companyId)
      .then(({ data }) => setWorkerBreakdown(groupByStatus(data)));

    supabase
      .from('equipment')
      .select('current_status')
      .eq('company_id', companyId)
      .then(({ data }) => setEquipmentBreakdown(groupByStatus(data)));

    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    supabase
      .from('certifications_with_status')
      .select('id, expiry_date, status, worker:workers(name), equipment:equipment(name), cert_type:cert_types(name_en)')
      .eq('company_id', companyId)
      .lte('expiry_date', in30Days.toISOString().slice(0, 10))
      .order('expiry_date', { ascending: true })
      .then(({ data }) => setExpiringCerts(data ?? []));

    supabase
      .from('projects')
      .select('id, name, status, resource_slots_manpower, resource_slots_equipment')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .then(({ data }) => setProjects(data ?? []));

    supabase
      .from('resource_requests')
      .select('id, quantity, start_date, end_date, project:projects(name), trade:trades(name_en)')
      .eq('company_id', companyId)
      .eq('fulfilled', false)
      .then(({ data }) => setRequests(data ?? []));
  }, [companyId]);

  const chartData = tab === 'manpower' ? workerBreakdown : equipmentBreakdown;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">{t('nav.dashboard')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Resource Allocation Donut */}
        <Widget title="Resource Allocation">
          <div className="flex gap-2 text-xs mb-2">
            {['manpower', 'equipment'].map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`px-2 py-1 rounded ${tab === tb ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                {tb === 'manpower' ? 'Manpower' : 'Equipment'}
              </button>
            ))}
          </div>
          <PieChart width={220} height={180}>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#64748b'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </Widget>

        {/* Upcoming Shortages */}
        <Widget title="Upcoming Shortages">
          {requests.length === 0 && <EmptyState text="No unfulfilled requests" />}
          <ul className="space-y-1 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex justify-between text-slate-300">
                <span>{r.project?.name}</span>
                <span className="text-amber-400">{r.quantity}× {r.trade?.name_en ?? 'resource'}</span>
              </li>
            ))}
          </ul>
        </Widget>

        {/* Certificate Expiry Mini-Calendar */}
        <Widget title="Certificate Expiry (30 days)">
          {expiringCerts.length === 0 && <EmptyState text="No certifications expiring soon" />}
          <ul className="space-y-1 text-sm max-h-40 overflow-y-auto">
            {expiringCerts.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span className="text-slate-300">
                  {(c.worker?.name ?? c.equipment?.name)} · {c.cert_type?.name_en}
                </span>
                <span className={c.status === 'expired' ? 'text-red-400' : c.status === 'expiring' ? 'text-amber-400' : 'text-yellow-300'}>
                  {c.expiry_date}
                </span>
              </li>
            ))}
          </ul>
        </Widget>

        {/* Live Project Status Cards */}
        <Widget title="Active Projects" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-2">
            {projects.map((p) => (
              <div key={p.id} className="rounded border border-slate-800 p-3">
                <p className="text-slate-100 text-sm font-medium">{p.name}</p>
                <p className="text-slate-500 text-xs">
                  {t('common.project')} slots: {p.resource_slots_manpower} manpower / {p.resource_slots_equipment} equipment
                </p>
              </div>
            ))}
          </div>
        </Widget>

        {/* Daily Operating Cost — replaces the old idle equipment tracker (Part C) */}
        <RoleGate roles={['ceo', 'ops_manager']}>
          <Widget title="Daily Operating Cost">
            <p className="text-slate-500 text-sm">See the Financial Overview page for the full breakdown.</p>
          </Widget>
        </RoleGate>
      </div>

      {/* Live Worker Map (Part A) — CEO/OpsManager only */}
      <RoleGate roles={['ceo', 'ops_manager']}>
        <LiveWorkerMap />
      </RoleGate>
    </div>
  );
}

function groupByStatus(rows) {
  const counts = {};
  (rows ?? []).forEach((r) => {
    counts[r.current_status] = (counts[r.current_status] ?? 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function Widget({ title, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-slate-800 bg-steel p-4 ${className}`}>
      <h3 className="text-slate-300 font-medium text-sm mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="text-slate-600 text-sm">{text}</p>;
}
