import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/auth.jsx';

const ROW_TONE = {
  expired: 'text-red-400',
  expiring: 'text-amber-400',
  valid: 'text-slate-300',
};

export default function DocumentsPage() {
  const { companyId } = useAuth();
  const [certs, setCerts] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('certifications_with_status')
      .select('id, expiry_date, issue_date, status, document_url, worker:workers(name), equipment:equipment(name), cert_type:cert_types(name_en)')
      .eq('company_id', companyId)
      .order('expiry_date', { ascending: true })
      .then(({ data }) => setCerts(data ?? []));
  }, [companyId]);

  const filtered = filter === 'all' ? certs : certs.filter((c) => c.status === filter);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-100">Documents & Compliance</h1>
      <div className="flex gap-2 text-sm">
        {['all', 'expired', 'expiring', 'valid'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full capitalize ${filter === f ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead className="text-slate-500 border-b border-slate-800 text-left">
          <tr>
            <th className="py-2">Type</th>
            <th>Holder</th>
            <th>Issue</th>
            <th>Expiry</th>
            <th>Status</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id} className="border-b border-slate-900">
              <td className="py-2 text-slate-200">{c.cert_type?.name_en}</td>
              <td className="text-slate-300">{c.worker?.name ?? c.equipment?.name}</td>
              <td className="text-slate-500">{c.issue_date}</td>
              <td className={ROW_TONE[c.status]}>{c.expiry_date}</td>
              <td className={`${ROW_TONE[c.status]} capitalize`}>{c.status}</td>
              <td>
                {c.document_url ? (
                  <a href={c.document_url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs">
                    View
                  </a>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-slate-600 text-xs">
        Compliance Pack generation (merged PDF per project) — TODO: implement via a Supabase Edge Function using the
        pdf skill, pulling assigned workers' certs + equipment inspection certs into one document.
      </p>
    </div>
  );
}
