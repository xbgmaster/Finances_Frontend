import { useMemo, useState } from 'react'
import { TrendingUp, ArrowLeftRight } from 'lucide-react'
import Modal from './Modal'
import { formatMoney } from '../utils/format'
import { iconFor } from '../utils/icons'
import { tintVars } from '../utils/color'

const GOLD = '#b8943e'

// Monthly calendar that plots the user's incomes (green) and expenses (red) on each day.
// Currency exchanges (transfers) are also shown (gold) so the user can see when a movement
// happened; they are not spending/income, so they never count toward the day's totals.
// Clicking any day opens its transactions so they can be edited, and lets you add new ones.
export default function ExpenseCalendar({
  year, month, expenses, incomes = [], exchanges = [], currency, t, categoryLabel, accountLabel,
  onEditExpense, onAddExpense, onEditIncome, onAddIncome,
}) {
  const [selectedDay, setSelectedDay] = useState(null)

  const pad = (n) => String(n).padStart(2, '0')
  const dateStrFor = (day) => `${year}-${pad(month)}-${pad(day)}`

  const inThisMonth = (d) => d.getFullYear() === year && d.getMonth() + 1 === month

  // Group the month's expenses / incomes by day-of-month.
  const expByDay = useMemo(() => {
    const map = {}
    for (const e of expenses) {
      const d = new Date(e.date)
      if (inThisMonth(d)) (map[d.getDate()] ||= []).push(e)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, year, month])

  const incByDay = useMemo(() => {
    const map = {}
    for (const i of incomes) {
      const d = new Date(i.date)
      if (inThisMonth(d)) (map[d.getDate()] ||= []).push(i)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes, year, month])

  const exByDay = useMemo(() => {
    const map = {}
    for (const x of exchanges) {
      const d = new Date(x.date)
      if (inThisMonth(d)) (map[d.getDate()] ||= []).push(x)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchanges, year, month])

  const firstDow = new Date(year, month - 1, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const sumOf = (list) => (list || []).reduce((s, x) => s + x.amount, 0)

  const expItems = selectedDay ? (expByDay[selectedDay] || []) : []
  const incItems = selectedDay ? (incByDay[selectedDay] || []) : []
  const exItems = selectedDay ? (exByDay[selectedDay] || []) : []

  return (
    <div className="exp-calendar">
      <div className="cal-grid cal-head">
        {t.calendar.weekdays.map((w, i) => <div key={i} className="cal-dow">{w}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} className="cal-cell empty" />
          const exps = expByDay[d] || []
          const incs = incByDay[d] || []
          const exs = exByDay[d] || []
          const has = exps.length > 0 || incs.length > 0 || exs.length > 0
          const isToday = isCurrentMonth && today.getDate() === d
          return (
            <button
              type="button"
              key={d}
              className={`cal-cell ${has ? 'has' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setSelectedDay(d)}
            >
              <div className="cal-daynum"><span>{d}</span></div>
              {/* Simple colored dots so cells stay readable even on small screens */}
              {has && (
                <div className="cal-dots">
                  {exps.length > 0 && <span className="cal-dot exp" />}
                  {incs.length > 0 && <span className="cal-dot inc" />}
                  {exs.length  > 0 && <span className="cal-dot xfr" />}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <Modal
          title={`${t.calendar.weekdaysLong[new Date(year, month - 1, selectedDay).getDay()]}, ${selectedDay} ${t.months[month - 1]} ${year}`}
          onClose={() => setSelectedDay(null)}
        >
          {/* Day totals bar — shown only when there is at least one movement */}
          {(incItems.length > 0 || expItems.length > 0 || exItems.length > 0) && (
            <div className="cal-day-summary">
              {expItems.length > 0 && (
                <span className="neg">
                  {t.calendar.expensesTitle}: <strong>−{formatMoney(sumOf(expItems), currency)}</strong>
                </span>
              )}
              {incItems.length > 0 && (
                <span className="pos">
                  {t.calendar.incomesTitle}: <strong>+{formatMoney(sumOf(incItems), currency)}</strong>
                </span>
              )}
              {exItems.length > 0 && (() => {
                const net = exItems.reduce((s, x) => s + (x.fromCurrency === currency ? -x.fromAmount : x.toAmount), 0)
                return (
                  <span style={{ color: GOLD }}>
                    {t.dashboard.exchange}: <strong>{net < 0 ? '−' : '+'}{formatMoney(Math.abs(net), currency)}</strong>
                  </span>
                )
              })()}
            </div>
          )}
          <div className="cal-day-actions">
            <div className="cal-day-totals" />
            <div className="cal-day-add">
              <button
                type="button"
                className="btn secondary"
                onClick={() => { const ds = dateStrFor(selectedDay); setSelectedDay(null); onAddIncome?.(ds) }}
              >
                {t.dashboard.addIncome}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => { const ds = dateStrFor(selectedDay); setSelectedDay(null); onAddExpense?.(ds) }}
              >
                {t.dashboard.addExpense}
              </button>
            </div>
          </div>

          {incItems.length === 0 && expItems.length === 0 && exItems.length === 0 && (
            <div className="empty">{t.calendar.noneDay}</div>
          )}

          {incItems.length > 0 && (
            <>
              <h4 className="cal-sec">{t.calendar.incomesTitle}</h4>
              <div className="list">
                {incItems
                  .slice()
                  .sort((a, b) => b.amount - a.amount)
                  .map((i) => (
                    <div className="list-item tinted" key={`inc-${i.id}`} style={tintVars('#10b981')}>
                      <span className="badge-icon"><TrendingUp size={16} /></span>
                      <div className="meta">
                        <div className="title">{i.description || t.calendar.incomeLabel}</div>
                        <div className="sub">{i.paymentMethodName ? accountLabel(i.paymentMethodName) : ''}</div>
                      </div>
                      <div className="list-item-end">
                        <span className="amount pos">+{formatMoney(i.amount, i.currency || currency)}</span>
                        <button className="btn secondary" onClick={() => { setSelectedDay(null); onEditIncome?.(i) }}>
                          {t.common.edit}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}

          {expItems.length > 0 && (
            <>
              <h4 className="cal-sec">{t.calendar.expensesTitle}</h4>
              <div className="list">
                {expItems
                  .slice()
                  .sort((a, b) => b.amount - a.amount)
                  .map((e) => (
                    <div className="list-item tinted" key={`exp-${e.id}`} style={tintVars(e.categoryColor || '#0f5c4d')}>
                      <span className="badge-icon">{iconFor(e.categoryIcon)}</span>
                      <div className="meta">
                        <div className="title">{e.description || categoryLabel(e.categoryName)}</div>
                        <div className="sub">
                          {categoryLabel(e.categoryName)}
                          {e.paymentMethodName ? ` · ${accountLabel(e.paymentMethodName)}` : ''}
                        </div>
                      </div>
                      <div className="list-item-end">
                        <span className="amount neg">−{formatMoney(e.amount, e.currency || currency)}</span>
                        <button className="btn secondary" onClick={() => { setSelectedDay(null); onEditExpense?.(e) }}>
                          {e.creditId ? t.calendar.view : t.common.edit}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}

          {exItems.length > 0 && (
            <>
              <h4 className="cal-sec">{t.expenses.transfersThisMonth}</h4>
              <div className="list">
                {exItems
                  .slice()
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((x) => {
                    const out = x.fromCurrency === currency
                    const amount = out ? x.fromAmount : x.toAmount
                    const otherAmount = out ? x.toAmount : x.fromAmount
                    const otherCurrency = out ? x.toCurrency : x.fromCurrency
                    const accountName = out ? x.fromPaymentMethodName : x.toPaymentMethodName
                    return (
                      <div className="list-item tinted" key={`ex-${x.id}`} style={tintVars(GOLD)}>
                        <span className="badge-icon"><ArrowLeftRight size={16} /></span>
                        <div className="meta">
                          <div className="title">{t.dashboard.exchange}</div>
                          <div className="sub">
                            {out
                              ? `${t.dashboard.toLabel} ${formatMoney(otherAmount, otherCurrency)}`
                              : `${t.dashboard.fromLabel} ${formatMoney(otherAmount, otherCurrency)}`}
                            {accountName ? ` · ${accountLabel(accountName)}` : ''}
                          </div>
                        </div>
                        <div className="list-item-end">
                          <span className={`amount ${out ? 'neg' : 'pos'}`}>
                            {out ? '−' : '+'}{formatMoney(amount, currency)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
