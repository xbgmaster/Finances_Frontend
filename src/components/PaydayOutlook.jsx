import { useEffect, useMemo, useState } from 'react'
import { Briefcase, CalendarClock, Repeat, TrendingUp, Wallet } from 'lucide-react'
import {
  BalanceApi, CreditsApi, ExpenseSchedulesApi, ExpensesApi,
  IncomeSchedulesApi, IncomesApi, PaymentMethodsApi,
} from '../api/client'
import StatCard from './StatCard'
import PageSpinner from './PageSpinner'
import { formatMoney, formatDate } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')

/** Deterministic cash forecast: available + expected paydays − subscriptions − today's debts. */
export default function PaydayOutlook() {
  const { t } = useI18n()
  const { currency: activeCurrency } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState([])
  const [expenseSchedules, setExpenseSchedules] = useState([])
  const [allIncomes, setAllIncomes] = useState([])
  const [allExpenses, setAllExpenses] = useState([])
  const [shifts, setShifts] = useState([])
  const [nextMonthShifts, setNextMonthShifts] = useState([])
  const [occOverrides, setOccOverrides] = useState([])
  const [availableBalance, setAvailableBalance] = useState(0)
  const [outstandingDebts, setOutstandingDebts] = useState(0)

  const year = now.getFullYear()
  const month = now.getMonth() + 1

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
      const [sch, expSch, inc, exp, pms, bal, credits, s, ov, sNext] = await Promise.all([
        IncomeSchedulesApi.list().catch(() => []),
        ExpenseSchedulesApi.list().catch(() => []),
        IncomesApi.list().catch(() => []),
        ExpensesApi.list().catch(() => []),
        PaymentMethodsApi.list().catch(() => []),
        BalanceApi.get().catch(() => null),
        CreditsApi.list({ currency: activeCurrency }).catch(() => []),
        IncomeSchedulesApi.shifts(year, month).catch(() => []),
        IncomeSchedulesApi.occurrenceOverrides(year, month).catch(() => []),
        IncomeSchedulesApi.shifts(next.y, next.m).catch(() => []),
      ])
      if (cancelled) return
      setSchedules(sch)
      setExpenseSchedules(expSch)
      setAllIncomes(inc)
      setAllExpenses(exp)
      setShifts(s)
      setOccOverrides(ov)
      setNextMonthShifts(sNext)
      const entry = (bal?.byCurrency ?? []).find((c) => c.currency === activeCurrency)
      setAvailableBalance(entry?.balance ?? 0)
      const cardDebt = pms
        .filter((p) => p.type === 'CreditCard' && !p.archived && p.currency === activeCurrency)
        .reduce((sum, p) => sum + (p.balance || 0), 0)
      const loanDebt = (credits || []).reduce((sum, c) => sum + (c.outstandingPrincipal || 0), 0)
      setOutstandingDebts(cardDebt + loanDebt)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [activeCurrency, year, month])

  const activeJobs = useMemo(
    () => schedules.filter((s) => s.active && s.currency === activeCurrency),
    [schedules, activeCurrency],
  )

  const activeSubs = useMemo(
    () => expenseSchedules.filter((s) => s.active && (s.currency || activeCurrency) === activeCurrency),
    [expenseSchedules, activeCurrency],
  )

  const monthShifts = useMemo(
    () => shifts.filter((s) => (s.currency || activeCurrency) === activeCurrency),
    [shifts, activeCurrency],
  )

  const dayEvents = useMemo(() => {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const horizon = new Date(year, month - 1 + 2, 0)
    const allShifts = [
      ...monthShifts,
      ...nextMonthShifts.filter((s) => (s.currency || activeCurrency) === activeCurrency),
    ]

    const payDaysForJob = (job, y, m) => {
      const dim = new Date(y, m, 0).getDate()
      if (job.payFrequency === 'Weekly' || job.payFrequency === 'Biweekly') {
        if (!job.anchorDate) return []
        const step = job.payFrequency === 'Weekly' ? 7 : 14
        const anchor = new Date(`${String(job.anchorDate).slice(0, 10)}T00:00:00`)
        const out = []
        for (let d = 1; d <= dim; d++) {
          const diff = Math.round((new Date(y, m - 1, d) - anchor) / 86400000)
          const mod = ((diff % step) + step) % step
          if (mod === 0) out.push(new Date(y, m - 1, d))
        }
        return out
      }
      const days = [Math.min(Math.max(1, job.dayOfMonth || 1), dim)]
      if (job.payFrequency === 'SemiMonthly') {
        days.push(Math.min(Math.max(1, job.secondDayOfMonth || dim), dim))
      }
      return [...new Set(days)].sort((a, b) => a - b).map((d) => new Date(y, m - 1, d))
    }

    const chargeDaysFor = (sub, y, m) => {
      const dim = new Date(y, m, 0).getDate()
      const days = [Math.min(Math.max(1, sub.dayOfMonth || 1), dim)]
      if (sub.payFrequency === 'SemiMonthly') {
        days.push(Math.min(Math.max(1, sub.secondDayOfMonth || dim), dim))
      }
      return [...new Set(days)].map((d) => new Date(y, m - 1, d))
    }

    const incomeAlreadyOn = (jobId, date) => allIncomes.some((i) => {
      if (i.incomeScheduleId !== jobId) return false
      const d = new Date(i.date)
      return d.getFullYear() === date.getFullYear()
        && d.getMonth() === date.getMonth()
        && d.getDate() === date.getDate()
    })

    const expenseAlreadyOn = (scheduleId, date) => allExpenses.some((e) => {
      if (e.expenseScheduleId !== scheduleId) return false
      const d = new Date(e.date)
      return d.getFullYear() === date.getFullYear()
        && d.getMonth() === date.getMonth()
        && d.getDate() === date.getDate()
    })

    const overrideAmt = (jobId, date) => {
      const o = occOverrides.find((x) => {
        const d = new Date(x.payDate)
        return x.incomeScheduleId === jobId
          && d.getFullYear() === date.getFullYear()
          && d.getMonth() === date.getMonth()
          && d.getDate() === date.getDate()
      })
      return o?.amount
    }

    const byDay = new Map()
    const ensure = (date) => {
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      if (!byDay.has(key)) {
        byDay.set(key, {
          date, expectedIncome: 0, expectedExpense: 0, incomeParts: [], expenseParts: [],
        })
      }
      return byDay.get(key)
    }

    const monthsToScan = [
      { y: year, m: month },
      month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 },
    ]

    for (const job of activeJobs) {
      for (const { y, m } of monthsToScan) {
        for (const date of payDaysForJob(job, y, m)) {
          if (date < startOfToday || date > horizon) continue
          let amount = 0
          const parts = []
          if (job.payType === 'Hourly') {
            const step = job.payFrequency === 'Weekly' ? 7
              : job.payFrequency === 'Biweekly' ? 14 : 0
            let prev = new Date(date)
            if (step > 0) prev.setDate(prev.getDate() - step)
            else if (job.payFrequency === 'SemiMonthly') {
              const days = payDaysForJob(job, y, m).map((d) => d.getDate()).sort((a, b) => a - b)
              const idx = days.indexOf(date.getDate())
              prev = idx > 0 ? new Date(y, m - 1, days[idx - 1]) : new Date(y, m - 1, 0)
            } else {
              prev = new Date(y, m - 1, 0)
            }
            const pending = allShifts
              .filter((s) => s.incomeScheduleId === job.id && !s.posted)
              .filter((s) => {
                const d = new Date(s.date)
                d.setHours(0, 0, 0, 0)
                return d > prev && d <= date
              })
              .reduce((sum, s) => sum + s.amount, 0)
            amount = pending
            if (pending > 0) parts.push({ name: job.name, amount: pending, kind: 'shifts' })
          } else if (!incomeAlreadyOn(job.id, date)) {
            const amt = overrideAmt(job.id, date) ?? job.amount ?? 0
            amount = amt
            if (amt > 0) parts.push({ name: job.name, amount: amt, kind: 'fixed' })
          }
          if (amount > 0 || parts.length > 0) {
            const day = ensure(date)
            day.expectedIncome += amount
            day.incomeParts.push(...parts)
          }
        }
      }
    }

    for (const sub of activeSubs) {
      for (const { y, m } of monthsToScan) {
        for (const date of chargeDaysFor(sub, y, m)) {
          if (date < startOfToday || date > horizon) continue
          if (expenseAlreadyOn(sub.id, date)) continue
          const amt = sub.amount || 0
          if (amt <= 0) continue
          const day = ensure(date)
          day.expectedExpense += amt
          day.expenseParts.push({ name: sub.name, amount: amt, kind: 'subscription' })
        }
      }
    }

    const ordered = [...byDay.values()]
      .filter((d) => d.expectedIncome > 0 || d.expectedExpense > 0)
      .sort((a, b) => a.date - b.date)

    let cumIncome = 0
    let cumExpense = 0
    return ordered.map((day) => {
      cumIncome += day.expectedIncome
      cumExpense += day.expectedExpense
      return {
        ...day,
        cumulativeIncome: cumIncome,
        cumulativeExpense: cumExpense,
        projected: availableBalance + cumIncome - cumExpense - outstandingDebts,
      }
    })
  }, [
    activeJobs, activeSubs, allIncomes, allExpenses, monthShifts, nextMonthShifts, occOverrides,
    year, month, activeCurrency, availableBalance, outstandingDebts,
  ])

  if (loading) return <PageSpinner />

  return (
    <div>
      <p className="hint" style={{ marginBottom: 16 }}>{t.projections.paydayHint}</p>
      <div className="grid grid-3" style={{ marginBottom: 12 }}>
        <StatCard
          label={t.dashboard.availableBalance}
          value={availableBalance}
          currency={activeCurrency}
          icon={<Wallet size={20} />}
          color="#0f5c4d"
          tone={availableBalance < 0 ? 'neg' : 'pos'}
        />
        <StatCard
          label={t.projections.outstandingDebts}
          value={outstandingDebts}
          currency={activeCurrency}
          icon={<Briefcase size={20} />}
          color="#ef4444"
          tone="neg"
        />
        <StatCard
          label={t.projections.afterDebtsNow}
          value={availableBalance - outstandingDebts}
          currency={activeCurrency}
          icon={<TrendingUp size={20} />}
          color="#b8943e"
          tone={(availableBalance - outstandingDebts) < 0 ? 'neg' : 'pos'}
        />
      </div>

      {activeJobs.length === 0 && activeSubs.length === 0 ? (
        <div className="empty">{t.projections.noJobsForPayday}</div>
      ) : dayEvents.length === 0 ? (
        <div className="empty">{t.projections.noUpcomingPays}</div>
      ) : (
        <div className="list">
          {dayEvents.map((p) => {
            const isSubOnly = p.expectedIncome <= 0 && p.expectedExpense > 0
            const net = p.expectedIncome - p.expectedExpense
            return (
              <div className="list-item outlook-item" key={p.date.toISOString()}>
                <span
                  className="badge-icon"
                  style={{
                    background: isSubOnly ? '#0f5c4d22' : '#b8943e22',
                    color: isSubOnly ? '#0f5c4d' : '#b8943e',
                  }}
                >
                  {isSubOnly ? <Repeat size={20} /> : <CalendarClock size={20} />}
                </span>
                <div className="meta">
                  <div className="title">
                    {isSubOnly
                      ? `${t.projections.subscriptionDay} · ${formatDate(p.date)}`
                      : `${t.projections.paymentDay} · ${formatDate(p.date)}`}
                  </div>
                  <div className="sub">
                    {[
                      ...p.incomeParts.map((part) => `${part.name} +${formatMoney(part.amount, activeCurrency)}`),
                      ...p.expenseParts.map((part) => `${part.name} −${formatMoney(part.amount, activeCurrency)}`),
                    ].join(' · ') || t.projections.projectionNoIncome}
                  </div>
                </div>
                <div className="outlook-figures">
                  <div className="outlook-fig">
                    <div className="hint">{t.projections.expectedIncome}</div>
                    <span className={`amount ${net < 0 ? 'neg' : 'pos'}`}>
                      {net < 0 ? '−' : '+'}{formatMoney(Math.abs(net), activeCurrency)}
                    </span>
                  </div>
                  <div className="outlook-fig">
                    <div className="hint">{t.projections.projectedAfter}</div>
                    <span className={`amount ${p.projected < 0 ? 'neg' : 'pos'}`}>
                      {formatMoney(p.projected, activeCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
