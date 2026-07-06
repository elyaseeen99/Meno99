import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth.jsx';
import WorkerLocationShare from '../features/location/WorkerLocationShare.jsx';

/**
 * QR scanning is stubbed as a manual worker-select for this scaffold — swap
 * in a camera-based QR reader (e.g. html5-qrcode) and match the scanned
 * worker.qr_code to pre-fill this flow.
 */
export default function CheckInPage() {
  const { profile, companyId } = useAuth();
  const [crew, setCrew] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState('');

  useEffect(() => {
    if (!companyId) return;
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from('assignments')
      .select('worker:workers(id, name, iqama_number)')
      .not('worker_id', 'is', null)
      .lte('start_date', today)
      .gte('end_date', today)
      .then(({ data }) => setCrew((data ?? []).map((a) => a.worker).filter(Boolean)));
  }, [companyId]);

  const checkIn = async () => {
    if (!selectedWorker) return;
    await supabase.from('checkinout').insert({
      company_id: companyId,
      worker_id: selectedWorker,
      foreman_id: profile.id,
      time_in: new Date().toISOString(),
    });
    setSelectedWorker('');
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      <h1 className="text-lg font-semibold text-slate-100">Today's Crew</h1>

      <select
        value={selectedWorker}
        onChange={(e) => setSelectedWorker(e.target.value)}
        className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
      >
        <option value="">Select worker (stand-in for QR scan)</option>
        {crew.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name} · {w.iqama_number}
          </option>
        ))}
      </select>

      <button onClick={checkIn} className="w-full py-3 rounded-lg bg-blue-700 text-white font-medium">
        Check In
      </button>

      {selectedWorker && <WorkerLocationShare workerId={selectedWorker} currentUserId={profile.id} mode="report" />}
    </div>
  );
}
