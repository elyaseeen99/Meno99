import { supabase } from '@/lib/supabaseClient';

/** Part C — Daily Financial Intelligence. CEO / Ops Manager only (enforced by RLS). */

export async function fetchTodaySpend(companyId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_project_costs')
    .select('project_id, manpower_cost, equipment_cost, transport_cost, delayed_resource_cost, total_cost')
    .eq('company_id', companyId)
    .eq('date', today);
  if (error) throw error;
  return data;
}

export async function fetchMonthToDate(companyId) {
  const start = new Date();
  start.setDate(1);
  const { data, error } = await supabase
    .from('daily_project_costs')
    .select('project_id, total_cost, date')
    .eq('company_id', companyId)
    .gte('date', start.toISOString().slice(0, 10));
  if (error) throw error;
  return data;
}

export async function fetchProjectBudgetSummaries() {
  // Uses the RLS-scoped view so PMs only ever see budget-vs-actual, never rates.
  const { data, error } = await supabase.from('project_budget_summary').select('*');
  if (error) throw error;
  return data;
}

export async function fetchDelayCostAlerts(companyId, { days = 7 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('delay_cost_logs')
    .select('*, project:projects(name), affected_equipment:equipment(name)')
    .eq('company_id', companyId)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

/** Estimated daily cost impact of adding a worker/equipment to a project —
 *  used as a tooltip on the Scheduling Board while dragging a resource. */
export async function estimateAssignmentCost({ workerId = null, equipmentId = null, tradeId = null, equipmentTypeId = null }) {
  if (workerId) {
    const { data: override } = await supabase
      .from('worker_cost_overrides')
      .select('cost_rate:cost_rates(amount, rate_type, overtime_multiplier)')
      .eq('worker_id', workerId)
      .maybeSingle();
    if (override?.cost_rate) return normalizeToDaily(override.cost_rate);
  }
  if (tradeId) {
    const { data } = await supabase
      .from('cost_rates')
      .select('amount, rate_type, overtime_multiplier')
      .eq('entity_type', 'manpower')
      .eq('trade_id', tradeId)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return normalizeToDaily(data);
  }
  if (equipmentTypeId) {
    const { data } = await supabase
      .from('cost_rates')
      .select('amount, rate_type, overtime_multiplier')
      .eq('entity_type', 'equipment')
      .eq('equipment_type_id', equipmentTypeId)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return normalizeToDaily(data);
  }
  return null; // no rate configured — UI should show "cost unknown" rather than 0
}

function normalizeToDaily({ amount, rate_type }) {
  if (rate_type === 'hourly') return amount * 8;
  if (rate_type === 'monthly') return amount / 30;
  return amount;
}
