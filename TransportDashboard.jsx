import { useEffect, useState } from 'react';
import { fetchTransportRequests } from './transportService';
import { useTranslation } from '@/lib/i18n';

const STATUS_COLOR = {
  pending: 'bg-slate-700 text-slate-200',
  assigned: 'bg-blue-700/30 text-blue-300 border border-blue-600',
  in_transit: 'bg-amber-600/20 text-amber-400 border border-amber-500',
  delivered: 'bg-green-600/20 text-green-400 border border-green-500',
};

/** Visible to Ops Manager and CEO — new "Transport & Logistics" nav item. */
export default function TransportDashboard({ onOpenRequest, onNewRequest }) {
  const { t, dir } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchTransportRequests({ status: statusFilter })
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const activeCount = requests.filter((r) => r.status === 'assigned').length;
  const inTransitCount = requests.filter((r) => r.status === 'in_transit').length;
  const delayedCount = requests.reduce(
    (n, r) => n + (r.assignment?.[0]?.checkpoints?.some((c) => c.status === 'delayed') ? 1 : 0),
    0
  );

  return (
    <div dir={dir} className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">
          {t('nav.transport', 'Transport & Logistics')}
        </h1>
        <button
          onClick={onNewRequest}
          className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-medium"
        >
          {t('transport.requestTransport', 'Request Transport')}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label={t('transport.activeTransports', 'Active Transports')} value={activeCount} />
        <SummaryCard label={t('transport.inTransit', 'In Transit')} value={inTransitCount} tone="amber" />
        <SummaryCard label={t('transport.delayed', 'Delayed')} value={delayedCount} tone="red" />
      </div>

      {/* Map render slot — show current in-transit positions if vehicles report GPS */}
      <div className="h-64 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-sm">
        {t('transport.mapPlaceholder', 'Live transport map')}
      </div>

      <div className="flex gap-2 text-sm">
        {['pending', 'assigned', 'in_transit', 'delivered'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`px-3 py-1 rounded-full ${statusFilter === s ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            {t(`transport.status.${s}`, s)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-700 divide-y divide-slate-800">
        {loading && <div className="p-4 text-slate-500 text-sm">{t('common.loading', 'Loading…')}</div>}
        {requests.map((r) => (
          <button
            key={r.id}
            onClick={() => onOpenRequest?.(r.id)}
            className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-800/50"
          >
            <div>
              <p className="text-slate-100 font-medium">{r.equipment_to_move?.name}</p>
              <p className="text-slate-400 text-xs">
                {r.source_project?.name ?? t('transport.yard', 'Yard')} → {r.destination_project?.name}
                {' · '}
                {r.desired_pickup_date} → {r.desired_delivery_date}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[r.status]}`}>
              {t(`transport.status.${r.status}`, r.status)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone = 'slate' }) {
  const toneClass = { slate: 'text-slate-100', amber: 'text-amber-400', red: 'text-red-400' }[tone];
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
