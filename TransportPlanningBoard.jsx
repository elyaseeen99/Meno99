import { useEffect, useState } from 'react';
import { fetchTransportRequests, fetchTransportFleet, assignTransport } from './transportService';
import { useTranslation } from '@/lib/i18n';

/**
 * Mirrors the pattern of the main Scheduling Board (Section 4): a left
 * "Resource Pool" of available transport vehicles + drivers, and a right
 * canvas of pending TransportRequests. Drop a vehicle chip onto a request
 * row, then pick a driver, to create a TransportAssignment.
 *
 * Uses native HTML5 drag-and-drop to match a lightweight scaffold; swap in
 * your existing DnD library if the main scheduling board already uses one.
 */
export default function TransportPlanningBoard() {
  const { t, dir } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [drivers, setDrivers] = useState([]); // pass in from your worker store, filtered by trade = 'driver'
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTransportRequests({ status: 'pending' }).then(setRequests);
    fetchTransportFleet().then(setFleet);
  }, []);

  const handleDrop = async (requestId, vehicleId) => {
    // In the full UI this opens a small picker for driver + optional escort;
    // scaffolded here as a placeholder prompt.
    const driverId = drivers[0]?.id;
    if (!driverId) {
      setError(t('transport.noDriverAvailable', 'No driver available to assign'));
      return;
    }
    try {
      await assignTransport({ transportRequestId: requestId, transportVehicleId: vehicleId, driverId });
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (e) {
      setError(e.message); // surfaces the DB conflict-trigger message directly
    }
  };

  return (
    <div dir={dir} className="flex h-full">
      {/* Resource Pool */}
      <aside className="w-64 border-r border-slate-800 p-3 space-y-2 overflow-y-auto">
        <h4 className="text-slate-400 text-xs uppercase tracking-wide">
          {t('transport.fleetPool', 'Transport Fleet')}
        </h4>
        {fleet.map((v) => (
          <div
            key={v.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('vehicleId', v.id)}
            className="p-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-200 cursor-grab active:cursor-grabbing"
          >
            {v.name} <span className="text-slate-500">({v.plate_number})</span>
          </div>
        ))}
      </aside>

      {/* Canvas: pending requests as drop targets */}
      <main className="flex-1 p-4 space-y-3 overflow-y-auto">
        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>
        )}
        {requests.map((r) => (
          <div
            key={r.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(r.id, e.dataTransfer.getData('vehicleId'))}
            className="rounded-lg border-2 border-dashed border-slate-700 p-4 hover:border-blue-600"
          >
            <p className="text-slate-100 font-medium">{r.equipment_to_move?.name}</p>
            <p className="text-slate-400 text-xs">
              {r.source_project?.name ?? t('transport.yard', 'Yard')} → {r.destination_project?.name}
              {' · '}
              {r.desired_pickup_date} → {r.desired_delivery_date}
              {r.priority === 'urgent' && (
                <span className="ml-2 text-amber-400 font-medium">{t('transport.urgent', 'URGENT')}</span>
              )}
            </p>
            <p className="text-slate-600 text-xs mt-1">{t('transport.dropVehicleHint', 'Drop a vehicle here to assign')}</p>
          </div>
        ))}
      </main>
    </div>
  );
}
