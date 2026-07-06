import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth.jsx';

const STATUS_OPTIONS = [
  { value: 'available', label: 'Arrived / Operational' },
  { value: 'under_maintenance', label: 'Broken / Needs Maintenance' },
];

export default function EquipmentStatusPage() {
  const { companyId } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState('available');

  useEffect(() => {
    if (!companyId) return;
    supabase.from('equipment').select('id, name').eq('company_id', companyId).then(({ data }) => setEquipment(data ?? []));
  }, [companyId]);

  const submit = async () => {
    if (!selected) return;
    await supabase.from('equipment').update({ current_status: status }).eq('id', selected);
    setSelected('');
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      <h1 className="text-lg font-semibold text-slate-100">Equipment Status</h1>

      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100"
      >
        <option value="">Select equipment (stand-in for QR scan)</option>
        {equipment.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>

      <div className="space-y-2">
        {STATUS_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-slate-300 text-sm">
            <input type="radio" checked={status === opt.value} onChange={() => setStatus(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>

      <button onClick={submit} className="w-full py-3 rounded-lg bg-blue-700 text-white font-medium">
        Update Status
      </button>
      <p className="text-slate-600 text-xs">Photo capture on status update — TODO: wire to Supabase Storage upload.</p>
    </div>
  );
}
