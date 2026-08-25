import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BalanceApi } from '../api/client'
import { formatMoney } from '../utils/format'
import { iconFor } from '../utils/icons'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

export default function BudgetHistory() {
  const { t } = useI18n()
  const { currency: activeCurrency } = useCurrency()
  const navigate = useNavigate()
  const [months, setMonths] = useState(6)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await BalanceApi.budgetHistory({ months, currency: activeCurrency }))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, activeCurrency])

  const monthLabel = (m) => `${t.months[m.month - 1].slice(0, 3)} ${String(m.year).slice(2)}`

  if (loading) return <div className="loading">{t.common.loading}</div>

  if (error || !data) {
    return (
      <div>
        <div className="page-header">
          <h1>{t.budgetHistory.title}</h1>
          <p>{t.budgetHistory.subtitle}</p>
        </div>
        <div className="empty">
          {t.budgetHistory.loadError}
          <div style={{ marginTop: 12 }}>
            <button className="btn secondary" onClick={load}>{t.budgetHistory.retry}</button>
          </div>
        </div>
      </div>
    )
  }

  const hasBudgets = data.categories.length > 0

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.budgetHistory.title}</h1>
          <p>{t.budgetHistory.subtitle}</p>
        </div>
        <div className="toolbar">
          <label style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t.budgetHistory.rangeLabel}</label>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            <option value={6}>{t.budgetHistory.months6}</option>
            <option value={12}>{t.budgetHistory.months12}</option>
          </select>
        </div>
      </div>

      {!hasBudgets ? (
        <div className="empty">
          {t.budgetHistory.noBudgets}
          <div style={{ marginTop: 12 }}>
            <button className="link-btn" onClick={() => navigate('/categories', { state: { openCreate: true } })}>
              {t.budgetHistory.goToCategories}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="insight"
            style={{ marginBottom: 20, borderColor: data.totalOverCount > 0 ? 'var(--danger)' : 'var(--success)' }}
          >
            <span>{data.totalOverCount > 0 ? '⚠️' : '✅'}</span>
            <span>
              {data.totalOverCount > 0
                ? t.budgetHistory.totalOver.replace('{count}', data.totalOverCount)
                : t.budgetHistory.noOverruns}
            </span>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table bh-table">
              <thead>
                <tr>
                  <th>{t.budgetHistory.category}</th>
                  {data.months.map((m) => (
                    <th key={`${m.year}-${m.month}`} className="num">{monthLabel(m)}</th>
                  ))}
                  <th className="num">{t.budgetHistory.overruns}</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.categoryId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="badge-icon" style={{ width: 34, height: 34, fontSize: 16, background: `${c.categoryColor}22`, color: c.categoryColor }}>
                          {iconFor(c.categoryIcon)}
                        </span>
                        <div>
                          <div className="title">{c.categoryName}</div>
                          <div className="sub">{t.budgetHistory.of} {formatMoney(c.monthlyBudget, activeCurrency)}</div>
                        </div>
                      </div>
                    </td>
                    {c.cells.map((cell) => (
                      <td
                        key={`${cell.year}-${cell.month}`}
                        className={`num bh-cell ${cell.spent === 0 ? 'bh-zero' : cell.over ? 'bh-over' : 'bh-under'}`}
                        title={`${cell.percent}%`}
                      >
                        {cell.spent === 0 ? '—' : formatMoney(cell.spent, activeCurrency)}
                      </td>
                    ))}
                    <td className="num">
                      {c.overCount > 0
                        ? <span className="pill pill-over">{c.overCount}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="field-hint" style={{ marginTop: 14 }}>{t.budgetHistory.budgetNote}</div>
        </>
      )}
    </div>
  )
}
