import { supabase } from '@/lib/supabaseClient';

/** Part B — Heavy Machine Transportation Management */

export async function fetchTransportRequests({ status = null } = {}) {
  let query = supabase
    .from('transport_requests')
    .select(`
      *,
      equipment_to_move:equipment!transport_requests_equipment_to_move_id_fkey ( id, name ),
      source_project:projects!transport_requests_source_project_id_fkey ( id, name ),
      destination_project:projects!transport_requests_destination_project_id_fkey ( id, name ),
      assignment:transport_assignments (
        id, actual_pickup_time, actual_delivery_time,
        driver:workers ( id, name ),
        transport_vehicle:equipment!transport_assignments_transport_vehicle_id_fkey ( id, name, plate_number ),
        checkpoints:transit_checkpoints ( id, status, created_at, notes )
      )
    `)
    .order('desired_pickup_date', { ascending: true });

  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createTransportRequest(payload) {
  const { data, error } = await supabase.from('transport_requests').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function assignTransport({ transportRequestId, transportVehicleId, driverId, escortWorkerId = null }) {
  const { data, error } = await supabase
    .from('transport_assignments')
    .insert({
      transport_request_id: transportRequestId,
      transport_vehicle_id: transportVehicleId,
      driver_id: driverId,
      escort_worker_id: escortWorkerId,
    })
    .select()
    .single();
  if (error) throw error; // trigger raises a clear conflict message if double-booked

  await supabase.from('transport_requests').update({ status: 'assigned' }).eq('id', transportRequestId);
  await supabase.from('equipment').update({ current_status: 'in_transit' }).eq('id', transportVehicleId);
  return data;
}

export async function logCheckpoint({ transportAssignmentId, status, latitude, longitude, notes }) {
  const { data, error } = await supabase
    .from('transit_checkpoints')
    .insert({ transport_assignment_id: transportAssignmentId, status, latitude, longitude, notes })
    .select()
    .single();
  if (error) throw error;

  if (status === 'delivered') {
    const { data: assignment } = await supabase
      .from('transport_assignments')
      .select('transport_request_id, transport_vehicle_id')
      .eq('id', transportAssignmentId)
      .single();

    await supabase.from('transport_requests').update({ status: 'delivered' }).eq('id', assignment.transport_request_id);
    await supabase.from('equipment').update({ current_status: 'available' }).eq('id', assignment.transport_vehicle_id);
  }

  if (status === 'delayed') {
    // Surface as a delay so it feeds both the transport dashboard and the
    // financial delay-cost log (see reportDelay below).
  }

  return data;
}

/** Driver taps "Report Delay" — logs a checkpoint AND a delay cost estimate. */
export async function reportDelay({ transportAssignmentId, transportRequestId, affectedEquipmentId, reason, dailyRate, companyId, projectId }) {
  await logCheckpoint({ transportAssignmentId, status: 'delayed', latitude: null, longitude: null, notes: reason });

  const { error } = await supabase.from('delay_cost_logs').insert({
    company_id: companyId,
    project_id: projectId,
    reason: `Transport delay: ${reason}`,
    affected_equipment_id: affectedEquipmentId,
    cost_impact: dailyRate ?? 0,
  });
  if (error) throw error;
}

export async function fetchTransportFleet() {
  // Vehicles are equipment rows whose equipment_type is a transport type
  // (lowbed / flatbed / escort_car) — filter client-side or via a DB view.
  const { data, error } = await supabase
    .from('equipment')
    .select('id, name, plate_number, capacity_ton, current_status, equipment_type:equipment_types(name_en, name_ar, is_transport)')
    .eq('equipment_types.is_transport', true);
  if (error) throw error;
  return data;
}
