import { useEffect, useMemo, useState } from 'react';
import {
  fetchTodaySpend,
  fetchMonthToDate,
  fetchProjectBudgetSummaries,
  fetchDelayCostAlerts,
} from './financialService';
import { useTranslation } from '@/lib/i18n';

/** New nav item: "Financial Overview" — visible to CEO (and Ops Manager if enabled). */
export default function FinancialDashboard({ companyId }) {
  const { t, dir } = useTranslation();
  const [today, setToday] = useState([]);
  const [mtd, setMtd] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [delays, setDelays] = useState([]);

  useEffect(() => {
    fetchTodaySpend(companyId).then(setToday);
    fetchMonthToDate(companyId).then(setMtd);
    fetchProjectBudgetSummaries().then(setBudgets);
    fetchDelayCostAlerts(companyId).then(setDelays);
  }, [companyId]);

  const todayTotal = useMemo(() => today.reduce((n, r) => n + Number(r.total_cost), 0), [today]);
  const idleToday = useMemo(() => today.reduce((n, r) => n + Number(r.delayed_resource_cost), 0), [today]);
  const mtdTotal = useMemo(() => mtd.reduce((n, r) => n + Number(r.total_cost), 0), [mtd]);
  const budgetTotal = useMemo(() => budgets.reduce((n, b) => n + Number(b.budget_amount), 0), [budgets]);

  return (
    <div dir={dir} className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-100">
        {t('nav.financial', 'Financial Overview')}
      </h1>

      <div className="grid grid-cols-3 gap-4">
        <BigCard
          label={t('financial.todaySpend', "Today's Spend")}
          value={`SAR ${todayTotal.toLocaleString()}`}
        />
        <BigCard
          label={t('financial.monthToDate', 'This Month')}
          value={`SAR ${mtdTotal.toLocaleString()}`}
          sub={t('financial.budgetOf', 'Budget: SAR {{amount}}', { amount: budgetTotal.toLocaleString() })}
        />
        <BigCard
          label={t('financial.idleAssetsCosting', 'Idle Assets Costing')}
          value={`SAR ${idleToday.toLocaleString()}/${t('common.day', 'day')}`}
          tone="amber"
        />
      </div>

      {/* Cost per project chart — plug into Chart.js/recharts using `today` */}
      <div className="h-56 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-sm">
        {t('financial.costPerProjectChart', 'Cost per project chart')}
      </div>

      <section>
        <h3 className="text-slate-300 font-medium mb-2">{t('financial.delayAlerts', 'Delay Cost Alerts')}</h3>
        <div className="space-y-2">
          {delays.length === 0 && <p className="text-slate-500 text-sm">{t('financial.noDelays', 'No delay costs logged recently')}</p>}
          {delays.map((d) => (
            <div key={d.id} className="rounded border border-amber-600/40 bg-amber-500/10 p-3 text-sm">
              <p className="text-amber-300">{d.project?.name}: {d.reason}</p>
              <p className="text-slate-400 text-xs">
                {t('financial.estimatedLoss', 'Estimated loss: SAR {{amount}}', { amount: Number(d.cost_impact).toLocaleString() })}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-slate-300 font-medium mb-2">{t('financial.mtdProjectCosts', 'Month-to-Date Project Costs')}</h3>
        <table className="w-full text-sm text-left">
          <thead className="text-slate-500 border-b border-slate-800">
            <tr>
              <th className="py-2">{t('common.project', 'Project')}</th>
              <th>{t('financial.budget', 'Budget')}</th>
              <th>{t('financial.actual', 'Actual')}</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.project_id} className="border-b border-slate-900">
                <td className="py-2 text-slate-200">{b.project_name}</td>
                <td className="text-slate-400">SAR {Number(b.budget_amount).toLocaleString()}</td>
                <td className="text-slate-400">SAR {Number(b.actual_to_date).toLocaleString()}</td>
                <td className={b.pct_spent >= 80 ? 'text-red-400 font-medium' : 'text-slate-400'}>
                  {b.pct_spent}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function BigCard({ label, value, sub, tone = 'slate' }) {
  const toneClass = { slate: 'text-slate-100', amber: 'text-amber-400' }[tone];
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
