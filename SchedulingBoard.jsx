import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/auth.jsx';

/**
 * Core Scheduling Board (Section 4). Resource-centric list view by default;
 * drag a worker/equipment chip onto a project to open the date picker and
 * create an Assignment. Conflict checking is enforced at the DB level
 * (trigger in 001_core_schema.sql) — this UI surfaces the resulting error.
 */
export default function SchedulingBoard() {
  const { companyId, role } = useAuth();
  const [pool, setPool] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // { type, id, projectId } awaiting date confirm

  const canEdit = role === 'ops_manager' || role === 'ceo';

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('workers')
      .select('id, name, current_status, trade:trades(name_en)')
      .eq('company_id', companyId)
      .neq('current_status', 'on_leave')
      .then(({ data }) => setPool((prev) => [...(data ?? []).map((w) => ({ ...w, kind: 'worker' })), ...prev.filter((p) => p.kind === 'equipment')]));

    supabase
      .from('equipment')
      .select('id, name, current_status, equipment_type:equipment_types(name_en)')
      .eq('company_id', companyId)
      .neq('current_status', 'under_maintenance')
      .then(({ data }) => setPool((prev) => [...prev.filter((p) => p.kind === 'worker'), ...(data ?? []).map((e) => ({ ...e, kind: 'equipment' }))]));

    supabase
      .from('projects')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .then(({ data }) => setProjects(data ?? []));
  }, [companyId]);

  const handleDrop = (projectId, e) => {
    if (!canEdit) return;
    const raw = e.dataTransfer.getData('resource');
    if (!raw) return;
    const resource = JSON.parse(raw);
    setPending({ ...resource, projectId });
  };

  const confirmAssignment = async (startDate, endDate) => {
    const payload = {
      company_id: companyId,
      project_id: pending.projectId,
      start_date: startDate,
      end_date: endDate,
      [pending.kind === 'worker' ? 'worker_id' : 'equipment_id']: pending.id,
    };
    const { error: insertError } = await supabase.from('assignments').insert(payload);
    if (insertError) {
      setError(insertError.message); // surfaces the DB conflict-trigger message
    } else {
      setPool((prev) => prev.map((p) => (p.id === pending.id ? { ...p, current_status: 'assigned' } : p)));
    }
    setPending(null);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="w-72 border-r border-slate-800 p-3 space-y-2 overflow-y-auto">
        <h4 className="text-slate-400 text-xs uppercase">Resource Pool</h4>
        {pool.map((r) => (
          <div
            key={`${r.kind}-${r.id}`}
            draggable={canEdit}
            onDragStart={(e) => e.dataTransfer.setData('resource', JSON.stringify({ id: r.id, kind: r.kind }))}
            className={`p-2 rounded border text-sm ${
              r.current_status === 'available'
                ? 'border-slate-700 bg-slate-800 text-slate-200'
                : 'border-slate-800 bg-slate-900 text-slate-600'
            } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            {r.name}{' '}
            <span className="text-slate-500 text-xs">
              ({r.kind === 'worker' ? r.trade?.name_en : r.equipment_type?.name_en})
            </span>
          </div>
        ))}
      </aside>

      <main className="flex-1 p-4 space-y-3 overflow-y-auto">
        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded p-2">{error}</div>
        )}
        {!canEdit && (
          <p className="text-slate-500 text-xs">View-only — only Ops Manager can create assignments.</p>
        )}
        {projects.map((p) => (
          <div
            key={p.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(p.id, e)}
            className="rounded-lg border-2 border-dashed border-slate-700 p-4 hover:border-blue-600 min-h-[4rem]"
          >
            <p className="text-slate-100 font-medium">{p.name}</p>
            <p className="text-slate-600 text-xs">Drop a resource here to assign</p>
          </div>
        ))}
      </main>

      {pending && <DateRangeModal onConfirm={confirmAssignment} onCancel={() => setPending(null)} />}
    </div>
  );
}

function DateRangeModal({ onConfirm, onCancel }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-steel border border-slate-700 rounded-lg p-5 w-80 space-y-3">
        <h4 className="text-slate-100 font-medium">Assignment dates</h4>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100" />
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-100" />
        <div className="flex justify-end gap-2 text-sm">
          <button onClick={onCancel} className="px-3 py-1 text-slate-400">Cancel</button>
          <button
            onClick={() => start && end && onConfirm(start, end)}
            className="px-3 py-1 rounded bg-blue-700 text-white"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
