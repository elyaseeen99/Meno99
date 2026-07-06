import { useEffect, useRef, useState } from 'react';
import { startLocationSharing, reportWorkerLocationManually } from './locationService';
import { useTranslation } from '@/lib/i18n';

/**
 * Mobile button set:
 *  - "Start Location Sharing" for a logged-in Worker/Foreman (self).
 *  - "Report Worker Location" for a Foreman reporting on behalf of a crew member.
 */
export default function WorkerLocationShare({ workerId, intervalMinutes = 5, currentUserId, mode = 'self' }) {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState(null);
  const stopRef = useRef(null);

  useEffect(() => () => stopRef.current?.stop?.(), []);

  const toggleSharing = () => {
    if (sharing) {
      stopRef.current?.stop?.();
      setSharing(false);
      return;
    }
    const handle = startLocationSharing({
      workerId,
      intervalMinutes,
      onPing: () => setError(null),
      onError: (e) => setError(e.message),
    });
    stopRef.current = handle;
    setSharing(true);
  };

  const reportOnce = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        reportWorkerLocationManually({
          workerId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          recordedBy: currentUserId,
        }).catch((e) => setError(e.message)),
      (e) => setError(e.message)
    );
  };

  if (mode === 'report') {
    return (
      <button
        onClick={reportOnce}
        className="w-full py-3 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 font-medium active:bg-slate-700"
      >
        {t('mobile.reportWorkerLocation', 'Report Worker Location')}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={toggleSharing}
        className={`w-full py-3 rounded-lg font-medium ${
          sharing ? 'bg-amber-600 text-white' : 'bg-blue-700 text-white'
        }`}
      >
        {sharing
          ? t('mobile.stopSharing', 'Stop Location Sharing')
          : t('mobile.startSharing', 'Start Location Sharing')}
      </button>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
