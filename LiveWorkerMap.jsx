import { useEffect, useMemo, useState } from 'react';
import { fetchLiveWorkerLocations } from './locationService';
import { useTranslation } from '@/lib/i18n'; // assumes existing bilingual hook

/**
 * Dashboard widget — "Live Worker Map" (CEO / Ops Manager only).
 * Wrap with your existing RoleGate before rendering this component.
 * Map rendering left as a slot: plug in Mapbox GL or Google Maps here.
 */
export default function LiveWorkerMap() {
  const { t, dir } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [projectFilter, setProjectFilter] = useState(null);
  const [onlyOnSite, setOnlyOnSite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLiveWorkerLocations({ projectId: projectFilter })
      .then((rows) => !cancelled && setLocations(rows))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [projectFilter]);

  const visible = useMemo(
    () => (onlyOnSite ? locations.filter((l) => l.is_within_geofence) : locations),
    [locations, onlyOnSite]
  );

  const offSiteCount = locations.filter((l) => l.is_within_geofence === false).length;

  return (
    <div dir={dir} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-100 font-semibold">{t('widget.liveWorkerMap', 'Live Worker Map')}</h3>
        {offSiteCount > 0 && (
          <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/40">
            {t('widget.offSiteAlert', '{{count}} possibly off-site', { count: offSiteCount })}
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-3 text-sm">
        {/* Wire this up to your existing project selector */}
        <label className="flex items-center gap-2 text-slate-300">
          <input type="checkbox" checked={onlyOnSite} onChange={(e) => setOnlyOnSite(e.target.checked)} />
          {t('widget.onSiteNow', 'On Site Now')}
        </label>
      </div>

      {/* Map render slot — integrate Mapbox GL/Google Maps here using `visible` */}
      <div className="h-72 rounded bg-slate-800 flex items-center justify-center text-slate-500 text-sm">
        {loading
          ? t('common.loading', 'Loading…')
          : t('widget.mapPinCount', '{{count}} worker pins', { count: visible.length })}
      </div>

      <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto text-sm">
        {visible.map((loc) => (
          <li key={loc.id} className="flex justify-between text-slate-300 border-b border-slate-800 py-1">
            <span>{loc.worker.name}</span>
            <span className={loc.is_within_geofence === false ? 'text-red-400' : 'text-slate-500'}>
              {loc.project?.name ?? t('common.unassigned', 'Unassigned')} · {new Date(loc.created_at).toLocaleTimeString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
