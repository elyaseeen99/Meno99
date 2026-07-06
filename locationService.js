import { supabase } from '@/lib/supabaseClient';

/**
 * Part A — Live Worker Location Tracking
 * Assumes an existing `supabase` client at src/lib/supabaseClient.js
 * (same one used by the rest of Meno).
 */

export async function pingWorkerLocation({ workerId, latitude, longitude, accuracy, source = 'gps_auto', recordedBy = null }) {
  const { data, error } = await supabase
    .from('worker_location_logs')
    .insert({
      worker_id: workerId,
      latitude,
      longitude,
      accuracy,
      source,
      recorded_by: recordedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Latest known position per tracked worker, for the CEO/Ops map widget. */
export async function fetchLiveWorkerLocations({ projectId = null, trade = null } = {}) {
  let query = supabase
    .from('worker_location_logs')
    .select(`
      id, latitude, longitude, accuracy, created_at, is_within_geofence,
      worker:workers ( id, name, trade_id, current_status, photo_url ),
      project:projects ( id, name )
    `)
    .order('created_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query.limit(2000);
  if (error) throw error;

  // Keep only the most recent ping per worker
  const latestByWorker = new Map();
  for (const row of data) {
    if (!latestByWorker.has(row.worker.id)) latestByWorker.set(row.worker.id, row);
  }
  let results = [...latestByWorker.values()];
  if (trade) results = results.filter((r) => r.worker.trade_id === trade);
  return results;
}

/** Browser geolocation -> periodic ping loop. Call `stop()` on unmount / toggle off. */
export function startLocationSharing({ workerId, intervalMinutes = 5, onPing, onError }) {
  if (!navigator.geolocation) {
    onError?.(new Error('Geolocation not supported on this device'));
    return { stop: () => {} };
  }

  const sendPing = () => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const record = await pingWorkerLocation({
            workerId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'gps_auto',
          });
          onPing?.(record);
        } catch (e) {
          onError?.(e);
        }
      },
      (err) => onError?.(err),
      { enableHighAccuracy: true, timeout: 20000 }
    );
  };

  sendPing(); // immediate first ping
  const intervalId = setInterval(sendPing, intervalMinutes * 60 * 1000);
  return { stop: () => clearInterval(intervalId) };
}

/** Manual "Report Worker Location" entry by a foreman. */
export async function reportWorkerLocationManually({ workerId, latitude, longitude, recordedBy }) {
  return pingWorkerLocation({ workerId, latitude, longitude, source: 'manual', recordedBy });
}
