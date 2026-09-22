import { useMemo, useState } from 'react'
import { TrendingUp, CalendarClock, Clock, Plus, Scissors } from 'lucide-react'
import Modal from './Modal'
import { formatMoney } from '../utils/format'
import { tintVars } from '../utils/color'

const GREEN = '#10b981'
const GOLD = '#b8943e'
const TEAL = '#0f5c4d'

// Monthly calendar for incomes: realized incomes (green), logged work shifts (teal) and the
// scheduled pay days / pay cuts of the user's jobs (gold). Clicking a day shows the detail and,
// when there are hourly jobs, lets the user log a shift for that day.
export default function IncomeCalendar({
  year, month, incomes = [], schedules = [], shifts = [], currency, t, accountLabel,
  onEditIncome, onAddPayment, onEditShift, onDeleteShift, onDeleteIncome,
  occurrenceOverrides = [],
}) {
  const [selectedDay, setSelectedDay] = useState(null)

  const inThisMonth = (d) => d.getFullYear() === year && d.getMonth() + 1 === month
  const daysInMonth = new Date(year, month, 0).getDate()
  const clampDay = (day) => Math.min(Math.max(1, day), daysInMonth)

  // Pay / pay-cut days of a job that fall in this month, sorted. Handles monthly, twice-a-month
  // and the date-based frequencies (weekly / every two weeks) anchored to a reference date.
  const payDaysFor = (s) => {
    if (s.payFrequency === 'Weekly' || s.payFrequency === 'Biweekly') {
      if (!s.anchorDate) return []
      const step = s.payFrequency === 'Weekly' ? 7 : 14
      const anchor = new Date(`${String(s.anchorDate).slice(0, 10)}T00:00:00`)
      const out = []
      for (let d = 1; d <= daysInMonth; d++) {
        const diff = Math.round((new Date(year, month - 1, d) - anchor) / 86400000)
        if (diff >= 0 && diff % step === 0) out.push(d)
      }
      return out
    }
    const days = [clampDay(s.dayOfMonth)]
    if (s.payFrequency === 'SemiMonthly') days.push(clampDay(s.secondDayOfMonth || daysInMonth))
    return [...new Set(days)].sort((a, b) => a - b)
  }

  const hourlyJobs = useMemo(
    () => schedules.filter((s) => s.active && s.payType === 'Hourly'),
    [schedules],
  )
  const fixedJobs = useMemo(
    () => schedules.filter((s) => s.active && s.payType !== 'Hourly'),
    [schedules],
  )
  const hasActiveJob = schedules.some((s) => s.active)

  // Build a lookup: scheduleId+dateStr → override amount (user-adjusted amount for that occurrence).
  const overrideMap = {}
  for (const o of occurrenceOverrides) {
    const d = new Date(o.payDate)
    if (inThisMonth(d)) overrideMap[`${o.incomeScheduleId}-${d.getDate()}`] = o.amount
  }
  const overrideFor = (scheduleId, day) => overrideMap[`${scheduleId}-${day}`] ?? null

  // Each job carries its own color; shifts are painted with it (like categories in Summary).
  const colorOf = (jobId) => schedules.find((s) => s.id === jobId)?.color || TEAL

  // How to render an income: if it's attributed to a job, use that job's color and — for hourly
  // jobs — show hours × rate and the job name, so it looks like a shift instead of a plain income.
  const incomeDisplay = (i) => {
    const job = schedules.find((s) => s.id === i.incomeScheduleId)
    if (!job) return { color: GREEN, label: i.description || t.calendar.incomeLabel, job: null, hours: null }
    const color = job.color || TEAL
    if (job.payType === 'Hourly' && job.hourlyRate > 0) {
      const hours = Math.round((i.amount / job.hourlyRate) * 100) / 100
      return { color, label: `${hours}${t.payroll.hoursShort} ${job.name}`, job, hours }
    }
    return { color, label: job.name, job, hours: null }
  }

  const incByDay = useMemo(() => {
    const map = {}
    for (const i of incomes) {
      const d = new Date(i.date)
      if (inThisMonth(d)) (map[d.getDate()] ||= []).push(i)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes, year, month])

  const shiftByDay = useMemo(() => {
    const map = {}
    for (const s of shifts) {
      const d = new Date(s.date)
      if (inThisMonth(d)) (map[d.getDate()] ||= []).push(s)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts, year, month])

  // Fixed jobs pay on each pay day; hourly jobs "cut" on each cut day (totaling shifts in window).
  const fixedByDay = useMemo(() => {
    const map = {}
    for (const s of fixedJobs) for (const day of payDaysFor(s)) (map[day] ||= []).push(s)
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedJobs, daysInMonth, year, month])

  // Unpaid shifts of a job whose day falls in the window (start exclusive, end inclusive).
  const pendingForWindow = (job, startExclusive, endInclusive) => shifts
    .filter((s) => {
      const d = new Date(s.date)
      return s.incomeScheduleId === job.id && !s.posted && inThisMonth(d)
        && d.getDate() > startExclusive && d.getDate() <= endInclusive
    })
    .reduce((sum, s) => sum + s.amount, 0)

  const cutByDay = useMemo(() => {
    const map = {}
    for (const job of hourlyJobs) {
      let prev = 0
      for (const day of payDaysFor(job)) {
        ;(map[day] ||= []).push({ job, pending: pendingForWindow(job, prev, day) })
        prev = day
      }
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourlyJobs, shifts, daysInMonth, year, month])

  const firstDow = new Date(year, month - 1, 1).getDay()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const sumOf = (list) => (list || []).reduce((s, x) => s + x.amount, 0)
  const sumHours = (list) => (list || []).reduce((s, x) => s + x.hours, 0)

  const incItems = selectedDay ? (incByDay[selectedDay] || []) : []
  const shiftItems = selectedDay ? (shiftByDay[selectedDay] || []) : []
  // Hide a job's scheduled pay once it has a real income that day (it was posted/recorded), so the
  // day shows a single entry instead of both the projection and the actual payment.
  const fixedItems = selectedDay
    ? (fixedByDay[selectedDay] || []).filter((s) => !incItems.some((i) => i.incomeScheduleId === s.id))
    : []
  const cutItems = selectedDay ? (cutByDay[selectedDay] || []) : []

  return (
    <div className="exp-calendar">
      <div className="cal-grid cal-head">
        {t.calendar.weekdays.map((w, i) => <div key={i} className="cal-dow">{w}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} className="cal-cell empty" />
          const incs = incByDay[d] || []
          const shs = shiftByDay[d] || []
          const fixed = fixedByDay[d] || []
          const cuts = cutByDay[d] || []
          const has = incs.length > 0 || shs.length > 0 || fixed.length > 0 || cuts.length > 0
          const isToday = isCurrentMonth && today.getDate() === d
          return (
            <button
              type="button"
              key={d}
              className={`cal-cell ${has ? 'has' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => setSelectedDay(d)}
            >
              <div className="cal-daynum"><span>{d}</span></div>
              {/* Compact dot indicators — same style as expense calendar */}
              {has && (() => {
                // Hide the scheduled/pending dot when a real income already covers that job on this day.
                const unpostedFixed = fixed.filter((s) => !incs.some((i) => i.incomeScheduleId === s.id))
                const showGold = cuts.length > 0 || unpostedFixed.length > 0
                return (
                  <div className="cal-dots">
                    {incs.length > 0 && (
                      <span className="cal-dot" style={{ background: incomeDisplay(incs[0]).color || GREEN }} />
                    )}
                    {shs.length > 0 && (
                      <span className="cal-dot" style={{ background: colorOf(shs[0].incomeScheduleId) }} />
                    )}
                    {showGold && (
                      <span className="cal-dot" style={{ background: GOLD }} />
                    )}
                  </div>
                )
              })()}
              <div className="cal-items" style={{ display: 'none' }}>
                {/* chips hidden; detail visible in day modal only */}
                {incs.slice(0, 1).map((i) => {
                  const disp = incomeDisplay(i)
                  return (
                    <span className="cal-chip" key={`i${i.id}`} style={tintVars(disp.color)} title={disp.label}>
                      {disp.label}
                    </span>
                  )
                })}
                {shs.slice(0, 2).map((s) => (
                  <span className="cal-chip" key={`w${s.id}`} style={tintVars(colorOf(s.incomeScheduleId))} title={`${s.jobName} · ${s.hours}${t.payroll.hoursShort}`}>
                    {s.hours}{t.payroll.hoursShort} {s.jobName}
                  </span>
                ))}
                {cuts.map((c) => (
                  <span className="cal-chip sched" key={`c${c.job.id}`} style={tintVars(GOLD)} title={`${c.job.name} · ${t.payroll.pendingTitle}`}>
                    {t.payroll.pendingTitle}: {formatMoney(c.pending, currency)}
                  </span>
                ))}
                {fixed
                  .filter((s) => !incs.some((i) => i.incomeScheduleId === s.id))
                  .map((s) => (
                    <span className="cal-chip sched" key={`s${s.id}`} style={tintVars(GOLD)} title={`${s.name} · ${formatMoney(s.amount, s.currency)}`}>
                      {s.name} · {t.payroll.payday}
                    </span>
                  ))}
              </div>
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <Modal
          title={`${t.calendar.weekdaysLong[new Date(year, month - 1, selectedDay).getDay()]}, ${selectedDay} ${t.months[month - 1]} ${year}`}
          onClose={() => setSelectedDay(null)}
        >
          <div className="cal-day-actions">
            <div className="cal-day-totals">
              {incItems.length > 0 && <strong className="pos">+{formatMoney(sumOf(incItems), currency)}</strong>}
              {shiftItems.length > 0 && (
                <span className="hint" style={{ color: 'var(--text-muted)' }}>
                  {sumHours(shiftItems)}{t.payroll.hoursShort} · {formatMoney(sumOf(shiftItems), currency)}
                </span>
              )}
            </div>
            {onAddPayment && hasActiveJob && (
              <div className="cal-day-add">
                <button
                  className="btn"
                  onClick={() => { const day = selectedDay; setSelectedDay(null); onAddPayment(day) }}
                >
                  <Plus size={16} /> {t.payroll.addPayment}
                </button>
              </div>
            )}
          </div>

          {incItems.length === 0 && shiftItems.length === 0 && fixedItems.length === 0 && cutItems.length === 0 && (
            <div className="empty">
              {hasActiveJob ? t.payroll.noIncomeDay : t.payroll.noJobsYet}
            </div>
          )}

          {shiftItems.length > 0 && (
            <>
              <h4 className="cal-sec">{t.payroll.shiftsTitle}</h4>
              <div className="list">
                {shiftItems.map((s) => (
                  <div className="list-item tinted" key={`sh-${s.id}`} style={tintVars(colorOf(s.incomeScheduleId))}>
                    <span className="badge-icon"><Clock size={16} /></span>
                    <div className="meta">
                      <div className="title">{s.jobName}</div>
                      <div className="sub">
                        {s.hours}{t.payroll.hoursShort} × {formatMoney(s.hourlyRate, s.currency || currency)}
                        {' · '}
                        <span className={`pill ${s.posted ? 'pill-auto' : 'pill-manual'}`}>
                          {s.posted ? t.payroll.shiftPaid : t.payroll.shiftPending}
                        </span>
                      </div>
                    </div>
                    <div className="list-item-end">
                      <span className="amount pos">+{formatMoney(s.amount, s.currency || currency)}</span>
                      {!s.posted && onEditShift && (
                        <button className="btn secondary" onClick={() => { setSelectedDay(null); onEditShift(s) }}>
                          {t.common.edit}
                        </button>
                      )}
                      {!s.posted && onDeleteShift && (
                        <button className="btn danger" onClick={() => onDeleteShift(s)}>
                          {t.common.delete}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {incItems.length > 0 && (
            <>
              <h4 className="cal-sec">{t.calendar.incomesTitle}</h4>
              <div className="list">
                {incItems
                  .slice()
                  .sort((a, b) => b.amount - a.amount)
                  .map((i) => {
                    const disp = incomeDisplay(i)
                    return (
                    <div className="list-item tinted" key={`inc-${i.id}`} style={tintVars(disp.color)}>
                      <span className="badge-icon">{disp.hours != null ? <Clock size={16} /> : <TrendingUp size={16} />}</span>
                      <div className="meta">
                        <div className="title">{disp.job ? disp.job.name : (i.description || t.calendar.incomeLabel)}</div>
                        <div className="sub">
                          {disp.hours != null
                            ? `${disp.hours}${t.payroll.hoursShort} × ${formatMoney(disp.job.hourlyRate, i.currency || currency)}`
                            : (i.paymentMethodName ? accountLabel(i.paymentMethodName) : '')}
                          {i.incomeScheduleId ? ` · ${t.payroll.autoPosted}` : ''}
                        </div>
                      </div>
                      <div className="list-item-end">
                        <span className="amount pos">+{formatMoney(i.amount, i.currency || currency)}</span>
                        {onEditIncome && (
                          <button className="btn secondary" onClick={() => { setSelectedDay(null); onEditIncome(i) }}>
                            {t.common.edit}
                          </button>
                        )}
                        {onDeleteIncome && (
                          <button className="btn danger" onClick={() => onDeleteIncome(i)}>
                            {t.common.delete}
                          </button>
                        )}
                      </div>
                    </div>
                    )
                  })}
              </div>
            </>
          )}

          {cutItems.length > 0 && (
            <>
              <h4 className="cal-sec">{t.payroll.pendingTitle}</h4>
              <div className="list">
                {cutItems.map((c) => (
                  <div className="list-item tinted" key={`cut-${c.job.id}`} style={tintVars(GOLD)}>
                    <span className="badge-icon"><Scissors size={16} /></span>
                    <div className="meta">
                      <div className="title">{c.job.name}</div>
                      <div className="sub">{t.payroll.cutsOnDay.replace('{day}', selectedDay)}</div>
                    </div>
                    <div className="list-item-end">
                      <span className="amount pos">+{formatMoney(c.pending, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {fixedItems.length > 0 && (
            <>
              <h4 className="cal-sec">{t.payroll.scheduledTitle}</h4>
              <div className="list">
                {fixedItems.map((s) => {
                  const overrideAmt = overrideFor(s.id, selectedDay)
                  const displayAmt = overrideAmt ?? s.amount
                  return (
                    <div className="list-item tinted" key={`sch-${s.id}`} style={tintVars(GOLD)}>
                      <span className="badge-icon"><CalendarClock size={16} /></span>
                      <div className="meta">
                        <div className="title">{s.name} · {t.payroll.payday}</div>
                        <div className="sub">
                          {s.autoPost ? t.payroll.autoBadge : t.payroll.manualBadge}
                          {s.paymentMethodName ? ` · ${accountLabel(s.paymentMethodName)}` : ''}
                          {overrideAmt !== null && (
                            <span style={{ color: GOLD, marginLeft: 6 }}>✎ {t.payroll.adjusted}</span>
                          )}
                        </div>
                      </div>
                      <div className="list-item-end">
                        <span className="amount pos">+{formatMoney(displayAmt, s.currency || currency)}</span>
                        {onAddPayment && s.active && (
                          <button
                            className="btn secondary"
                            onClick={() => { const day = selectedDay; setSelectedDay(null); onAddPayment(day, s.id) }}
                          >
                            {t.payroll.recordPay}
                          </button>
                        )}
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
