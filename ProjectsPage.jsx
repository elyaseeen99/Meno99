import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/auth.jsx';
import FinancialDashboard from '../../features/financial/FinancialDashboard.jsx';

export function ProjectsListPage() {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('projects')
      .select('id, name, client_name, status, resource_slots_manpower, resource_slots_equipment')
      .eq('company_id', companyId)
      .then(({ data }) => setProjects(data ?? []));
  }, [companyId]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-100">Projects</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/projects/${p.id}`)}
            className="text-left rounded-lg border border-slate-800 bg-steel p-4 hover:border-blue-600"
          >
            <p className="text-slate-100 font-medium">{p.name}</p>
            <p className="text-slate-500 text-xs">{p.client_name}</p>
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 capitalize">
              {p.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProjectWorkspacePage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => setProject(data));
    supabase
      .from('assignments')
      .select('id, start_date, end_date, worker:workers(name), equipment:equipment(name)')
      .eq('project_id', id)
      .then(({ data }) => setAssignments(data ?? []));
  }, [id]);

  if (!project) return <div className="p-6 text-slate-500">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-100">{project.name}</h1>
      <div className="flex gap-2 text-sm">
        {['overview', 'assigned', 'documents', 'financials'].map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-3 py-1 rounded-full capitalize ${tab === tb ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            {tb}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="rounded-lg border border-slate-800 p-4 text-slate-300 text-sm space-y-1">
          <p>Client: {project.client_name}</p>
          <p>
            {project.start_date} → {project.end_date ?? 'ongoing'}
          </p>
          <p>
            Slots: {project.resource_slots_manpower} manpower / {project.resource_slots_equipment} equipment
          </p>
        </div>
      )}

      {tab === 'assigned' && (
        <ul className="space-y-1 text-sm">
          {assignments.map((a) => (
            <li key={a.id} className="text-slate-300 border-b border-slate-900 py-1">
              {a.worker?.name ?? a.equipment?.name} · {a.start_date} → {a.end_date}
            </li>
          ))}
        </ul>
      )}

      {tab === 'documents' && <p className="text-slate-500 text-sm">Document uploader — TODO: wire to Supabase Storage.</p>}

      {tab === 'financials' && <FinancialDashboard companyId={project.company_id} />}
    </div>
  );
}
