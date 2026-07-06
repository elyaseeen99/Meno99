import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/auth.jsx';

/**
 * Resource pool: workers + equipment for the company, with a simple
 * name/status listing. Worker profile modal / bulk Excel import are
 * left as TODOs — wire in per MODULES_README.md integration checklist.
 */
export default function ResourcesPage() {
  const { companyId } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [{ data: workerRows }, { data: equipmentRows }] = await Promise.all([
        supabase.from('workers').select('*').eq('company_id', companyId),
        supabase.from('equipment').select('*').eq('company_id', companyId),
      ]);
      if (!cancelled) {
        setWorkers(workerRows || []);
        setEquipment(equipmentRows || []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">Resources</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-300">Workers</h2>
        <div className="rounded-lg border border-slate-800 bg-steel divide-y divide-slate-800">
          {loading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {!loading && workers.length === 0 && (
            <p className="p-4 text-sm text-slate-500">No workers found.</p>
          )}
          {workers.map((w) => (
            <div key={w.id} className="p-3 flex items-center justify-between text-sm">
              <span className="text-slate-100">{w.full_name}</span>
              <span className="text-slate-500">{w.trade || w.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-300">Equipment</h2>
        <div className="rounded-lg border border-slate-800 bg-steel divide-y divide-slate-800">
          {loading && <p className="p-4 text-sm text-slate-500">Loading…</p>}
          {!loading && equipment.length === 0 && (
            <p className="p-4 text-sm text-slate-500">No equipment found.</p>
          )}
          {equipment.map((e) => (
            <div key={e.id} className="p-3 flex items-center justify-between text-sm">
              <span className="text-slate-100">{e.name}</span>
              <span className="text-slate-500">{e.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
