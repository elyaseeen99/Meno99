const REPORT_TYPES = [
  { key: 'daily_manpower', label: 'Daily Manpower Deployment Report' },
  { key: 'equipment_utilization', label: 'Equipment Utilization Report' },
  { key: 'certification_matrix', label: 'Certification Matrix' },
];

/**
 * Each report type should call a Supabase Edge Function (or client-side
 * query + the xlsx/pdf skill patterns) to generate the export. Stubbed here
 * as buttons; wire `onGenerate` to your export pipeline.
 */
export default function ReportsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold text-slate-100">Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORT_TYPES.map((r) => (
          <div key={r.key} className="rounded-lg border border-slate-800 bg-steel p-4 space-y-3">
            <p className="text-slate-100 text-sm font-medium">{r.label}</p>
            <button
              onClick={() => alert(`TODO: generate ${r.key} export`)}
              className="w-full py-2 rounded bg-blue-700 text-white text-sm"
            >
              Generate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
