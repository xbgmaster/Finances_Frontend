import { useEffect, useMemo, useState } from 'react'
import { Briefcase, CalendarClock, TrendingUp, Wallet } from 'lucide-react'
import {
  BalanceApi, CreditsApi, IncomeSchedulesApi, IncomesApi, PaymentMethodsApi,
} from '../api/client'
import StatCard from './StatCard'
import { formatMoney, formatDate } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')

/** Deterministic cash forecast: available + expected paydays − today's debts. */
export default function PaydayOutlook() {
  const { t } = useI18n()
  const { currency: activeCurrency } = useCurrency()
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState([])
  const [allIncomes, setAllIncomes] = useState([])
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
      const [sch, inc, pms, bal, credits, s, ov, sNext] = await Promise.all([
        IncomeSchedulesApi.list().catch(() => []),
        IncomesApi.list().catch(() => []),
        PaymentMethodsApi.list().catch(() => []),
        BalanceApi.get().catch(() => null),
        CreditsApi.list({ currency: activeCurrency }).catch(() => []),
        IncomeSchedulesApi.shifts(year, month).catch(() => []),
        IncomeSchedulesApi.occurrenceOverrides(year, month).catch(() => []),
        IncomeSchedulesApi.shifts(next.y, next.m).catch(() => []),
      ])
      if (cancelled) return
      setSchedules(sch)
      setAllIncomes(inc)
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

  const monthShifts = useMemo(
    () => shifts.filter((s) => (s.currency || activeCurrency) === activeCurrency),
    [shifts, activeCurrency],
  )

  const payDayProjections = useMemo(() => {
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

    const incomeAlreadyOn = (jobId, date) => allIncomes.some((i) => {
      if (i.incomeScheduleId !== jobId) return false
      const d = new Date(i.date)
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

    const events = []
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
            events.push({ date, amount, parts })
          }
        }
      }
    }

    const byDay = new Map()
    for (const ev of events) {
      const key = `${ev.date.getFullYear()}-${pad(ev.date.getMonth() + 1)}-${pad(ev.date.getDate())}`
      const cur = byDay.get(key) || { date: ev.date, expectedIncome: 0, parts: [] }
      cur.expectedIncome += ev.amount
      cur.parts.push(...ev.parts)
      byDay.set(key, cur)
    }

    const ordered = [...byDay.values()].sort((a, b) => a.date - b.date)
    let cumulative = 0
    return ordered.map((day) => {
      cumulative += day.expectedIncome
      return {
        ...day,
        cumulativeIncome: cumulative,
        projected: availableBalance + cumulative - outstandingDebts,
      }
    })
  }, [
    activeJobs, allIncomes, monthShifts, nextMonthShifts, occOverrides,
    year, month, activeCurrency, availableBalance, outstandingDebts,
  ])

  if (loading) return <div className="loading">{t.common.loading}</div>

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

      {activeJobs.length === 0 ? (
        <div className="empty">{t.projections.noJobsForPayday}</div>
      ) : payDayProjections.length === 0 ? (
        <div className="empty">{t.projections.noUpcomingPays}</div>
      ) : (
        <div className="list">
          {payDayProjections.map((p) => (
            <div className="list-item" key={p.date.toISOString()}>
              <span className="badge-icon" style={{ background: '#b8943e22', color: '#b8943e' }}>
                <CalendarClock size={20} />
              </span>
              <div className="meta">
                <div className="title">
                  {t.projections.paymentDay} · {formatDate(p.date)}
                </div>
                <div className="sub">
                  {p.parts.map((part) => `${part.name} +${formatMoney(part.amount, activeCurrency)}`).join(' · ')}
                  {p.parts.length === 0 && t.projections.projectionNoIncome}
                </div>
              </div>
              <div className="list-item-end" style={{ textAlign: 'right' }}>
                <div className="hint">{t.projections.expectedIncome}</div>
                <span className="amount pos">+{formatMoney(p.expectedIncome, activeCurrency)}</span>
                <div className="hint" style={{ marginTop: 4 }}>{t.projections.projectedAfter}</div>
                <span className={`amount ${p.projected < 0 ? 'neg' : 'pos'}`}>
                  {formatMoney(p.projected, activeCurrency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
