import { formatMoney } from '../utils/format'

export default function StatCard({ label, value, icon, color = '#6366f1', tone, hint, isMoney = true }) {
  return (
    <div className="card stat-card">
      <div className="top">
        <span className="label">{label}</span>
        <span className="badge-icon" style={{ background: `${color}22`, color }}>{icon}</span>
      </div>
      <div className={`value ${tone || ''}`}>{isMoney ? formatMoney(value) : value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  )
}
