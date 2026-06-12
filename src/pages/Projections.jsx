import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { ProjectionApi } from '../api/client'
import StatCard from '../components/StatCard'
import { formatMoney } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'

export default function Projections() {
  const { t, language } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingsRate, setSavingsRate] = useState(20)

  const load = async (rate) => {
    setLoading(true)
    setData(await ProjectionApi.get({ savingsRate: rate / 100, historyMonths: 6, lang: language }))
    setLoading(false)
  }

  // Recarga al montar y cuando cambia el idioma (insights vienen localizados del backend).
  useEffect(() => {
    load(savingsRate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const applyRate = () => load(savingsRate)

  if (loading && !data) return <div className="loading">{t.projections.analyzing}</div>

  const trendLabel = {
    up: t.projections.trendUp,
    down: t.projections.trendDown,
    stable: t.projections.trendStable,
  }[data.trend] || data.trend

  const trendColor = data.trend === 'up' ? '#ef4444' : data.trend === 'down' ? '#10b981' : '#f59e0b'

  const chartData = data.history.map((h) => ({
    name: `${t.months[h.month - 1].slice(0, 3)} ${String(h.year).slice(2)}`,
    [t.projections.chartIncome]: Number(h.income),
    [t.projections.chartExpenses]: Number(h.expense),
  }))

  return (
    <div>
      <div className="page-header">
        <h1>{t.projections.title} 🤖</h1>
        <p>{t.projections.subtitle}</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600 }}>{t.projections.savingsGoal}</div>
            <div className="hint">{t.projections.savingsGoalHint}</div>
          </div>
          <div className="toolbar">
            <input
              type="range" min="0" max="80" step="5"
              value={savingsRate}
              onChange={(e) => setSavingsRate(Number(e.target.value))}
              style={{ width: 200 }}
            />
            <strong style={{ minWidth: 48 }}>{savingsRate}%</strong>
            <button className="btn" onClick={applyRate} disabled={loading}>
              {loading ? t.projections.calculating : t.projections.recalculate}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard
          label={t.projections.projectedNextMonth}
          value={data.projectedExpenseNextMonth}
          icon="🔮"
          color={trendColor}
          hint={`${t.projections.trend}: ${trendLabel}`}
        />
        <StatCard label={t.projections.recommendedSavings} value={data.recommendedSavings} icon="🐷" color="#10b981" />
        <StatCard
          label={t.projections.canSpend}
          value={data.safeToSpend}
          icon="✅"
          color="#6366f1"
          tone="pos"
          hint={`≈ ${formatMoney(data.safeToSpendPerDayRemaining)}/${t.projections.perDay} (${data.daysRemainingInMonth} ${t.projections.daysLeft})`}
        />
        <StatCard label={t.projections.currentBalance} value={data.currentBalance} icon="💰" color="#22d3ee" />
      </div>

      <h2 className="section-title">{t.projections.trendSection}</h2>
      <div className="card">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#283251" />
            <XAxis dataKey="name" stroke="#94a3c4" fontSize={12} />
            <YAxis stroke="#94a3c4" fontSize={12} />
            <Tooltip
              contentStyle={{ background: '#1a2236', border: '1px solid #283251', borderRadius: 12 }}
              formatter={(value) => formatMoney(value)}
            />
            <Legend />
            <Area type="monotone" dataKey={t.projections.chartExpenses} stroke="#ef4444" fill="url(#gExp)" strokeWidth={2} />
            <Line type="monotone" dataKey={t.projections.chartIncome} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="hint" style={{ marginTop: 8, textAlign: 'center' }}>
          {t.projections.chartNote}
        </div>
      </div>

      <h2 className="section-title">{t.projections.recommendations}</h2>
      <div className="grid" style={{ gap: 12 }}>
        {data.insights.map((tip, i) => (
          <div className="insight" key={i}>
            <span>💡</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginTop: 24 }}>
        <StatCard label={t.projections.avgIncome} value={data.avgMonthlyIncome} icon="📊" color="#10b981" />
        <StatCard label={t.projections.avgExpense} value={data.avgMonthlyExpense} icon="📊" color="#ef4444" />
      </div>
    </div>
  )
}
