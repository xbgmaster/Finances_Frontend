import { formatMoney } from '../utils/format'

export default function StatCard({ label, value, icon, color = '#0f5c4d', tone, hint, isMoney = true, currency }) {
  return (
    <div className="card stat-card">
      <div className="top">
        <span className="label">{label}</span>
        <span className="badge-icon" style={{ background: `${color}22`, color }}>{icon}</span>
      </div>
      <div className={`value ${tone || ''}`}>{isMoney ? formatMoney(value, currency) : value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}
