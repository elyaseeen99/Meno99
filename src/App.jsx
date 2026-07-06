import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { isSupabaseConfigured } from './lib/supabaseClient.js';
import AppShell from './components/layout/AppShell.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ResourcesPage from './pages/Resources/ResourcesPage.jsx';
import { ProjectsListPage, ProjectWorkspacePage } from './pages/Projects/ProjectsPage.jsx';
import SchedulingBoard from './pages/Scheduling/SchedulingBoard.jsx';
import DocumentsPage from './pages/Documents/DocumentsPage.jsx';
import ReportsPage from './pages/Reports/ReportsPage.jsx';
import SettingsPage from './pages/Settings/SettingsPage.jsx';
import CheckInPage from './pages/CheckIn.jsx';
import EquipmentStatusPage from './pages/EquipmentStatus.jsx';
import TransportDashboard from './features/transport/TransportDashboard.jsx';
import TransportPlanningBoard from './features/transport/TransportPlanningBoard.jsx';
import FinancialDashboard from './features/financial/FinancialDashboard.jsx';

export default function App() {
  const { session, loading } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-graphite text-slate-300 px-6 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-lg font-semibold text-white">Supabase isn't configured yet</p>
          <p className="text-sm text-slate-400">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables, then redeploy.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-graphite text-slate-500">Loading…</div>;

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/resources" element={<ResourcesPage />} />
        <Route path="/projects" element={<ProjectsListPage />} />
        <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
        <Route path="/scheduling" element={<SchedulingBoard />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/checkin" element={<CheckInPage />} />
        <Route path="/equipment-status" element={<EquipmentStatusPage />} />
        <Route path="/transport" element={<TransportRoute />} />
        <Route path="/transport/planning" element={<TransportPlanningBoard />} />
        <Route path="/financial" element={<FinancialRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function TransportRoute() {
  return <TransportDashboard onNewRequest={() => alert('TODO: open new transport request form')} onOpenRequest={() => {}} />;
}

function FinancialRoute() {
  const { companyId } = useAuth();
  return <FinancialDashboard companyId={companyId} />;
}
