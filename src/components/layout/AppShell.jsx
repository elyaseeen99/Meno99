import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from '../../lib/i18n.jsx';
import { useAuth } from '../../lib/auth.jsx';
import RoleGate from './RoleGate.jsx';

const NAV_ITEMS = [
  { to: '/', key: 'nav.dashboard', roles: ['ceo', 'ops_manager', 'project_manager', 'foreman'] },
  { to: '/resources', key: 'nav.resources', roles: ['ceo', 'ops_manager', 'project_manager'] },
  { to: '/projects', key: 'nav.projects', roles: ['ceo', 'ops_manager', 'project_manager'] },
  { to: '/scheduling', key: 'nav.scheduling', roles: ['ceo', 'ops_manager', 'project_manager'] },
  { to: '/documents', key: 'nav.documents', roles: ['ceo', 'ops_manager', 'project_manager'] },
  { to: '/reports', key: 'nav.reports', roles: ['ceo', 'ops_manager'] },
  { to: '/transport', key: 'nav.transport', roles: ['ceo', 'ops_manager'] },
  { to: '/financial', key: 'nav.financial', roles: ['ceo', 'ops_manager'] },
  { to: '/settings', key: 'nav.settings', roles: ['ceo'] },
];

// Foreman gets a simplified mobile tab bar per Section 7 of the spec
const MOBILE_FOREMAN_ITEMS = [
  { to: '/', key: 'nav.dashboard' },
  { to: '/checkin', key: 'mobile.checkIn' },
  { to: '/equipment-status', key: 'mobile.equipmentStatus' },
];

export default function AppShell() {
  const { t, dir, lang, setLang } = useTranslation();
  const { profile, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isForeman = profile?.role === 'foreman';

  return (
    <div dir={dir} className="flex h-screen bg-graphite text-slate-100">
      {/* Desktop sidebar */}
      {!isForeman && (
        <aside
          className={`hidden md:flex flex-col border-r border-slate-800 bg-steel transition-all ${
            collapsed ? 'w-16' : 'w-60'
          }`}
        >
          <div className="p-3 flex items-center justify-between">
            {!collapsed && <span className="font-semibold tracking-wide">Meno</span>}
            <button onClick={() => setCollapsed((c) => !c)} className="text-slate-400 text-xs">
              {collapsed ? '»' : '«'}
            </button>
          </div>
          <nav className="flex-1 px-2 space-y-1">
            {NAV_ITEMS.map((item) => (
              <RoleGate key={item.to} roles={item.roles}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded text-sm ${
                      isActive ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`
                  }
                >
                  {collapsed ? item.key.slice(4, 6).toUpperCase() : t(item.key)}
                </NavLink>
              </RoleGate>
            ))}
          </nav>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-steel">
          <span className="text-sm text-slate-400">{profile?.full_name}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-300"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-slate-200">
              {t('auth.logout', 'Log Out')}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom tab bar (foreman-optimized, per Section 7) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-steel border-t border-slate-800 flex">
          {(isForeman ? MOBILE_FOREMAN_ITEMS : NAV_ITEMS.slice(0, 4)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex-1 flex items-center justify-center text-xs ${isActive ? 'text-blue-400' : 'text-slate-400'}`
              }
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
