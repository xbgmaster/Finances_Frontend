import { useEffect, useMemo, useState } from 'react'
import { Briefcase, CalendarClock, TrendingUp, Clock, Plus } from 'lucide-react'
import { IncomeSchedulesApi, IncomesApi, PaymentMethodsApi } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import IncomeCalendar from '../components/IncomeCalendar'
import { useToast } from '../components/Toast'
import { formatMoney, formatDate } from '../utils/format'
import { COLOR_PALETTE } from '../utils/icons'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const now = new Date()
const pad = (n) => String(n).padStart(2, '0')

export default function Payroll() {
  const { t, accountLabel } = useI18n()
  const { currency: activeCurrency } = useCurrency()
  const toast = useToast()

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [schedules, setSchedules] = useState([])
  const [allIncomes, setAllIncomes] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(null)

  // Job modal
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', payType: 'Fixed', amount: '', hourlyRate: '', currency: '', color: COLOR_PALETTE[0],
    payFrequency: 'Monthly', dayOfMonth: '', secondDayOfMonth: '', anchorDate: '',
    paymentMethodId: '', autoPost: true, active: true,
  })

  // Shift modal
  const [showShift, setShowShift] = useState(false)
  const [savingShift, setSavingShift] = useState(false)
  const [editingShiftId, setEditingShiftId] = useState(null)
  const [shiftError, setShiftError] = useState('')
  const [shiftForm, setShiftForm] = useState({ incomeScheduleId: '', date: '', hours: '', hourlyRate: '', amount: '' })

  // Income edit modal (fix a payment added by mistake).
  const [showIncome, setShowIncome] = useState(false)
  const [savingIncome, setSavingIncome] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState(null)
  const [incomeError, setIncomeError] = useState('')
  const [incomeForm, setIncomeForm] = useState({ amount: '', hours: '', hourlyRate: '', description: '', date: '', currency: '', paymentMethodId: '', incomeScheduleId: '' })

  const loadCore = async () => {
    // Catch up: post any pay day / pay cut that already passed but wasn't recorded yet.
    try { await IncomeSchedulesApi.postDue() } catch { /* non-critical */ }
    const [sch, inc, pms] = await Promise.all([
      IncomeSchedulesApi.list().catch(() => []),
      IncomesApi.list().catch(() => []),
      PaymentMethodsApi.list().catch(() => []),
    ])
    setSchedules(sch)
    setAllIncomes(inc)
    setPaymentMethods(pms)
  }

  const loadShifts = async (y, m) => {
    const s = await IncomeSchedulesApi.shifts(y, m).catch(() => [])
    setShifts(s)
  }

  const refresh = async () => { await loadCore(); await loadShifts(year, month) }

  useEffect(() => {
    (async () => { await loadCore(); setLoading(false) })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadShifts(year, month)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const years = useMemo(() => {
    const y = now.getFullYear()
    return [y - 2, y - 1, y, y + 1]
  }, [])

  // Everything is scoped to the active currency lens (like the rest of the app).
  const currencySchedules = schedules.filter((s) => s.currency === activeCurrency)
  const activeJobs = currencySchedules.filter((s) => s.active)
  const monthShifts = shifts.filter((s) => (s.currency || activeCurrency) === activeCurrency)
  const monthIncomes = allIncomes.filter((i) => {
    const d = new Date(i.date)
    const inMonth = d.getFullYear() === year && d.getMonth() + 1 === month
    return inMonth && (i.currency || activeCurrency) === activeCurrency
  })

  const receivedThisMonth = monthIncomes.reduce((s, i) => s + i.amount, 0)
  const pendingShifts = monthShifts.filter((s) => !s.posted).reduce((s, x) => s + x.amount, 0)
  const nextPay = currencySchedules
    .filter((s) => s.active)
    .map((s) => new Date(s.nextPayDate))
    .sort((a, b) => a - b)[0]

  const bestNonCreditPm = (cur) => {
    const active = paymentMethods.filter((p) => !p.archived && p.currency === cur && p.type !== 'CreditCard')
    return String(active.find((p) => p.isFavorite)?.id ?? active[0]?.id ?? '')
  }

  const pmTypeLabel = (type) =>
    type === 'CreditCard' ? t.cards.typeCreditCard
      : type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit

  // ---- Job modal ----------------------------------------------------------------------------

  const openCreate = () => {
    setEditingId(null)
    setError('')
    setForm({
      name: '', payType: 'Fixed', amount: '', hourlyRate: '',
      currency: activeCurrency, color: COLOR_PALETTE[0], payFrequency: 'Monthly',
      dayOfMonth: String(now.getDate()), secondDayOfMonth: '',
      anchorDate: `${year}-${pad(month)}-${pad(now.getDate())}`,
      paymentMethodId: bestNonCreditPm(activeCurrency), autoPost: true, active: true,
    })
    setShowModal(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setError('')
    setForm({
      name: s.name || '',
      payType: s.payType || 'Fixed',
      amount: String(s.amount ?? ''),
      hourlyRate: String(s.hourlyRate ?? ''),
      currency: s.currency || activeCurrency,
      color: s.color || COLOR_PALETTE[0],
      payFrequency: s.payFrequency || 'Monthly',
      dayOfMonth: String(s.dayOfMonth ?? ''),
      secondDayOfMonth: String(s.secondDayOfMonth ?? ''),
      anchorDate: s.anchorDate ? String(s.anchorDate).slice(0, 10) : `${year}-${pad(month)}-${pad(now.getDate())}`,
      paymentMethodId: s.paymentMethodId ?? '',
      autoPost: !!s.autoPost,
      active: !!s.active,
    })
    setShowModal(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const isHourly = form.payType === 'Hourly'
    const freq = form.payFrequency
    const isDateBased = freq === 'Weekly' || freq === 'Biweekly'
    const isSemi = freq === 'SemiMonthly'
    const day = parseInt(form.dayOfMonth, 10)
    const day2 = parseInt(form.secondDayOfMonth, 10)
    const amount = parseFloat(form.amount)
    const rate = parseFloat(form.hourlyRate)
    if (!form.name.trim()) return
    if (isHourly ? (!rate || rate <= 0) : (!amount || amount <= 0)) return
    setError('')
    if (isDateBased) {
      if (!form.anchorDate) return
    } else {
      if (!day || day < 1 || day > 31) return
      if (isSemi) {
        if (!day2 || day2 < 1 || day2 > 31) return
        if (day2 <= day) { setError(t.payroll.secondAfterFirst); return }
      }
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        payType: form.payType,
        amount: isHourly ? 0 : amount,
        hourlyRate: isHourly ? rate : undefined,
        currency: form.currency || activeCurrency,
        color: form.color,
        payFrequency: freq,
        dayOfMonth: isDateBased ? undefined : day,
        secondDayOfMonth: isSemi ? day2 : undefined,
        anchorDate: isDateBased ? form.anchorDate : undefined,
        paymentMethodId: form.paymentMethodId ? Number(form.paymentMethodId) : undefined,
        autoPost: form.autoPost,
      }
      if (editingId) await IncomeSchedulesApi.update(editingId, { ...payload, active: form.active })
      else await IncomeSchedulesApi.create(payload)
      setShowModal(false)
      await refresh()
      toast.success(t.common.savedOk)
    } catch (err) {
      setError(err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    try {
      await IncomeSchedulesApi.remove(id)
      await refresh()
      toast.success(t.common.deletedOk)
    } catch (err) {
      toast.error(err?.response?.data?.message || t.expenses.deleteError)
    }
  }

  // ---- Shift modal --------------------------------------------------------------------------

  const openAddPayment = (day, preselectJobId) => {
    if (activeJobs.length === 0) { toast.error(t.payroll.noJobsYet); return }
    // Only prefill when a specific job is targeted (per-job button or "Record / adjust"); the
    // global and per-day "Add payment" open on "Select a job" so nothing is assumed.
    const job = preselectJobId ? activeJobs.find((j) => String(j.id) === String(preselectJobId)) : null
    const d = day || now.getDate()
    setEditingShiftId(null)
    setShiftError('')
    setShiftForm({
      incomeScheduleId: job ? String(job.id) : '',
      date: `${year}-${pad(month)}-${pad(d)}`,
      hours: '',
      hourlyRate: job ? String(job.hourlyRate ?? '') : '',
      // Prefill fixed jobs with their scheduled amount so the user can adjust a specific pay
      // (e.g. a raise or a lower month) before recording it.
      amount: job && job.payType !== 'Hourly' ? String(job.amount ?? '') : '',
    })
    setShowShift(true)
  }

  const openEditShift = (s) => {
    setEditingShiftId(s.id)
    setShiftError('')
    const d = new Date(s.date)
    setShiftForm({
      incomeScheduleId: String(s.incomeScheduleId),
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      hours: String(s.hours ?? ''),
      hourlyRate: String(s.hourlyRate ?? ''),
      amount: '',
    })
    setShowShift(true)
  }

  const selectedShiftJob = activeJobs.find((j) => String(j.id) === String(shiftForm.incomeScheduleId))
  const isHourlySelected = selectedShiftJob?.payType === 'Hourly'
  const effectiveRate = parseFloat(shiftForm.hourlyRate) || selectedShiftJob?.hourlyRate || 0
  const shiftPreview = (parseFloat(shiftForm.hours) || 0) * effectiveRate

  // Edit-income modal adapts to the chosen job: hourly jobs are entered as hours × rate.
  const selectedIncomeJob = activeJobs.find((j) => String(j.id) === String(incomeForm.incomeScheduleId))
  const incomeIsHourly = selectedIncomeJob?.payType === 'Hourly'
  const incomeRate = parseFloat(incomeForm.hourlyRate) || selectedIncomeJob?.hourlyRate || 0
  const incomePreview = (parseFloat(incomeForm.hours) || 0) * incomeRate

  const submitShift = async (e) => {
    e.preventDefault()
    if (!selectedShiftJob) { setShiftError(t.payroll.pickJobPlaceholder); return }
    if (!shiftForm.date) return
    setSavingShift(true)
    setShiftError('')
    try {
      if (isHourlySelected) {
        const hours = parseFloat(shiftForm.hours)
        const rate = parseFloat(shiftForm.hourlyRate) || selectedShiftJob?.hourlyRate
        if (!hours || hours <= 0 || !rate || rate <= 0) { setSavingShift(false); return }
        if (editingShiftId) {
          await IncomeSchedulesApi.updateShift(editingShiftId, { date: shiftForm.date, hours, hourlyRate: rate })
        } else {
          await IncomeSchedulesApi.createShift({
            incomeScheduleId: Number(shiftForm.incomeScheduleId),
            date: shiftForm.date, hours, hourlyRate: rate,
          })
        }
      } else {
        // Fixed job: a direct payment posted as income that day.
        const amount = parseFloat(shiftForm.amount)
        if (!amount || amount <= 0) { setSavingShift(false); return }
        await IncomeSchedulesApi.createPayment(Number(shiftForm.incomeScheduleId), { date: shiftForm.date, amount })
      }
      setShowShift(false)
      await refresh()
      toast.success(t.common.savedOk)
    } catch (err) {
      setShiftError(err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSavingShift(false)
    }
  }

  const removeShift = async (s) => {
    setConfirm({
      message: t.payroll.deleteShiftConfirm,
      run: async () => {
        try {
          await IncomeSchedulesApi.removeShift(s.id)
          await refresh()
          toast.success(t.common.deletedOk)
        } catch (err) {
          toast.error(err?.response?.data?.message || t.expenses.deleteError)
        }
      },
    })
  }

  // Edit a posted income straight from the calendar (e.g. wrong amount/date on a payment).
  const openEditIncome = (i) => {
    setEditingIncomeId(i.id)
    setIncomeError('')
    const d = new Date(i.date)
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const job = schedules.find((s) => s.id === i.incomeScheduleId)
    const rate = job?.payType === 'Hourly' ? (job.hourlyRate || 0) : 0
    // For hourly jobs derive the hours from the stored amount so the form opens pre-filled.
    const hours = rate > 0 ? Math.round((i.amount / rate) * 100) / 100 : ''
    setIncomeForm({
      amount: String(i.amount ?? ''),
      hours: hours === '' ? '' : String(hours),
      hourlyRate: rate ? String(rate) : '',
      description: i.description || '',
      date: iso,
      currency: i.currency || activeCurrency,
      paymentMethodId: String(i.paymentMethodId ?? ''),
      incomeScheduleId: String(i.incomeScheduleId ?? ''),
    })
    setShowIncome(true)
  }

  const submitIncome = async (e) => {
    e.preventDefault()
    // Hourly jobs are entered as hours × rate; fixed jobs as a flat amount.
    const amount = incomeIsHourly ? incomePreview : parseFloat(incomeForm.amount)
    if (!amount || amount <= 0) { setIncomeError(t.expenses.saveError); return }
    setSavingIncome(true)
    setIncomeError('')
    try {
      await IncomesApi.update(editingIncomeId, {
        amount,
        description: incomeForm.description,
        date: incomeForm.date ? new Date(incomeForm.date).toISOString() : undefined,
        currency: incomeForm.currency || activeCurrency,
        paymentMethodId: incomeForm.paymentMethodId ? Number(incomeForm.paymentMethodId) : undefined,
        incomeScheduleId: incomeForm.incomeScheduleId ? Number(incomeForm.incomeScheduleId) : undefined,
      })
      setShowIncome(false)
      await refresh()
      toast.success(t.common.savedOk)
    } catch (err) {
      setIncomeError(err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSavingIncome(false)
    }
  }

  // Delete a posted income straight from the calendar (e.g. a payment added by mistake).
  const removeIncome = async (i) => {
    setConfirm({
      message: t.payroll.deleteIncomeConfirm,
      run: async () => {
        try {
          await IncomesApi.remove(i.id)
          await refresh()
          toast.success(t.common.deletedOk)
        } catch (err) {
          toast.error(err?.response?.data?.message || t.expenses.deleteError)
        }
      },
    })
  }

  if (loading) return <div className="loading">{t.common.loading}</div>

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.payroll.title}</h1>
          <p>{t.payroll.subtitle}</p>
        </div>
        <div className="toolbar">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {t.months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {activeJobs.length > 0 && (
            <button className="btn secondary" onClick={() => openAddPayment()}>{t.payroll.addPayment}</button>
          )}
          <button className="btn" onClick={openCreate}>{t.payroll.addJob}</button>
        </div>
      </div>

      <div className="grid grid-3">
        <StatCard label={t.payroll.receivedThisMonth} value={receivedThisMonth} currency={activeCurrency} icon={<TrendingUp size={20} />} color="#10b981" />
        <StatCard label={t.payroll.pendingThisMonth} value={pendingShifts} currency={activeCurrency} icon={<Clock size={20} />} color="#0f5c4d" />
        <StatCard
          label={t.payroll.nextPay}
          value={nextPay ? formatDate(nextPay) : '—'}
          icon={<CalendarClock size={20} />}
          color="#b8943e"
          isMoney={false}
        />
      </div>

      <h2 className="section-title">{t.payroll.jobsTitle}</h2>
      {currencySchedules.length === 0 ? (
        <div className="empty">{t.payroll.noJobs}</div>
      ) : (
        <div className="grid grid-2">
          {currencySchedules.map((s) => {
            const isHourly = s.payType === 'Hourly'
            // For hourly jobs, show the dynamic total logged this month (updates as shifts are added,
            // e.g. extra shifts), instead of the static rate.
            const monthTotal = isHourly
              ? monthShifts.filter((w) => w.incomeScheduleId === s.id).reduce((sum, w) => sum + w.amount, 0)
              : 0
            const weekday = s.anchorDate
              ? t.calendar.weekdaysLong[new Date(`${String(s.anchorDate).slice(0, 10)}T00:00:00`).getDay()]
              : ''
            let dayText
            if (s.payFrequency === 'Weekly') dayText = t.payroll.weeklyOn.replace('{day}', weekday)
            else if (s.payFrequency === 'Biweekly') dayText = t.payroll.biweeklyOn.replace('{day}', weekday)
            else if (s.payFrequency === 'SemiMonthly') {
              dayText = isHourly
                ? t.payroll.cutsOnDays.replace('{a}', s.dayOfMonth).replace('{b}', s.secondDayOfMonth)
                : t.payroll.paysOnDays.replace('{a}', s.dayOfMonth).replace('{b}', s.secondDayOfMonth)
            } else {
              dayText = isHourly
                ? t.payroll.cutsOnDay.replace('{day}', s.dayOfMonth)
                : t.payroll.paysOnDay.replace('{day}', s.dayOfMonth)
            }
            return (
              <div className={`card job-card ${!s.active ? 'paused' : ''}`} key={s.id}>
                <div className="row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="badge-icon" style={{ background: `${s.color || '#b8943e'}22`, color: s.color || '#b8943e' }}>
                      <Briefcase size={18} />
                    </span>
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.name}</div>
                      <div className="hint" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {dayText} · {t.payroll.next}: {formatDate(s.nextPayDate)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>
                      {isHourly ? formatMoney(monthTotal, s.currency) : formatMoney(s.amount, s.currency)}
                    </div>
                    {isHourly && (
                      <div className="hint" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {t.payroll.thisMonth} · {formatMoney(s.hourlyRate || 0, s.currency)}/{t.payroll.hoursShort}
                      </div>
                    )}
                    <div className="job-badges">
                      <span className="pill pill-manual">
                        {isHourly ? t.payroll.payTypeHourly : t.payroll.payTypeFixed}
                      </span>
                      <span className={`pill ${s.autoPost ? 'pill-auto' : 'pill-manual'}`}>
                        {s.autoPost ? t.payroll.autoBadge : t.payroll.manualBadge}
                      </span>
                      {!s.active && <span className="pill pill-paused">{t.payroll.pausedBadge}</span>}
                    </div>
                  </div>
                </div>
                {s.paymentMethodName && (
                  <div className="hint" style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                    {accountLabel(s.paymentMethodName)}
                  </div>
                )}
                <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
                  {s.active && (
                    <button className="btn secondary" onClick={() => openAddPayment(null, s.id)}>
                      <Plus size={16} /> {t.payroll.addPayment}
                    </button>
                  )}
                  <button className="btn secondary" onClick={() => openEdit(s)}>{t.common.edit}</button>
                  <button
                    className="btn danger"
                    onClick={() => setConfirm({ message: t.payroll.deleteConfirm.replace('{name}', s.name), run: () => remove(s.id) })}
                  >
                    {t.common.delete}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <h2 className="section-title">{t.payroll.calendarTitle}</h2>
      <div className="card">
        <IncomeCalendar
          year={year}
          month={month}
          incomes={monthIncomes}
          schedules={currencySchedules}
          shifts={monthShifts}
          currency={activeCurrency}
          t={t}
          accountLabel={accountLabel}
          onAddPayment={openAddPayment}
          onEditShift={openEditShift}
          onDeleteShift={removeShift}
          onEditIncome={openEditIncome}
          onDeleteIncome={removeIncome}
        />
      </div>

      {showModal && (
        <Modal
          title={editingId ? t.payroll.editJobTitle : t.payroll.addJobTitle}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={submit}>
            <div className="field">
              <label>{t.payroll.jobName}</label>
              <input
                type="text" autoFocus required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.payroll.jobNamePlaceholder}
              />
            </div>
            <div className="field">
              <label>{t.payroll.payType}</label>
              <select value={form.payType} onChange={(e) => setForm({ ...form, payType: e.target.value })}>
                <option value="Fixed">{t.payroll.payTypeFixed}</option>
                <option value="Hourly">{t.payroll.payTypeHourly}</option>
              </select>
            </div>
            <div className="field-row">
              <div className="field" style={{ flex: 2 }}>
                <label>{form.payType === 'Hourly' ? t.payroll.hourlyRate : t.common.amount}</label>
                {form.payType === 'Hourly' ? (
                  <input
                    type="number" step="0.01" min="0" required
                    value={form.hourlyRate}
                    onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                    placeholder="0.00"
                  />
                ) : (
                  <input
                    type="number" step="0.01" min="0" required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                  />
                )}
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.common.currency}</label>
                <div className="static-field" title={t.dashboard.currencyLensHint}>
                  {form.currency || activeCurrency}
                </div>
              </div>
            </div>
            <div className="field">
              <label>{t.payroll.payFrequency}</label>
              <select value={form.payFrequency} onChange={(e) => setForm({ ...form, payFrequency: e.target.value })}>
                <option value="Weekly">{t.payroll.frequencyWeekly}</option>
                <option value="Biweekly">{t.payroll.frequencyBiweekly}</option>
                <option value="SemiMonthly">{t.payroll.frequencySemiMonthly}</option>
                <option value="Monthly">{t.payroll.frequencyMonthly}</option>
              </select>
            </div>

            {(form.payFrequency === 'Weekly' || form.payFrequency === 'Biweekly') ? (
              <div className="field">
                <label>{form.payType === 'Hourly' ? t.payroll.firstCutDate : t.payroll.firstPayDate}</label>
                <input
                  type="date" required
                  value={form.anchorDate}
                  onChange={(e) => setForm({ ...form, anchorDate: e.target.value })}
                />
                <div className="field-hint" style={{ marginTop: 6, marginBottom: 12 }}>
                  {t.payroll.anchorDateHint}
                </div>
              </div>
            ) : (
              <>
                <div className="field-row">
                  <div className="field" style={{ flex: 1 }}>
                    <label>{form.payType === 'Hourly' ? t.payroll.payCutDay : t.payroll.payDay}</label>
                    <input
                      type="number" min="1" max="31" required
                      value={form.dayOfMonth}
                      onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  {form.payFrequency === 'SemiMonthly' && (
                    <div className="field" style={{ flex: 1 }}>
                      <label>{form.payType === 'Hourly' ? t.payroll.secondPayCutDay : t.payroll.secondPayDay}</label>
                      <input
                        type="number" min="1" max="31" required
                        value={form.secondDayOfMonth}
                        onChange={(e) => setForm({ ...form, secondDayOfMonth: e.target.value })}
                        placeholder="15"
                      />
                    </div>
                  )}
                </div>
                <div className="field-hint" style={{ marginTop: 0, marginBottom: 12 }}>
                  {form.payType === 'Hourly' ? t.payroll.payCutHint : t.payroll.payDayHint}
                </div>
              </>
            )}
            <div className="field">
              <label>{t.common.paymentMethod}</label>
              <select
                value={form.paymentMethodId}
                onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value })}
              >
                <option value="">{t.payroll.noAccount}</option>
                {paymentMethods
                  .filter((p) => !p.archived && p.type !== 'CreditCard'
                    && (p.currency === (form.currency || activeCurrency) || String(p.id) === String(form.paymentMethodId)))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{accountLabel(p.name)} · {pmTypeLabel(p.type)}</option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label>{t.payroll.color}</label>
              <div className="color-grid">
                {COLOR_PALETTE.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={`color-pick ${form.color === color ? 'active' : ''}`}
                    style={{ background: color }}
                    onClick={() => setForm({ ...form, color })}
                  />
                ))}
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.autoPost}
                onChange={(e) => setForm({ ...form, autoPost: e.target.checked })}
              />
              <span>{t.payroll.autoPostLabel}</span>
            </label>
            {editingId && (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>{t.payroll.activeLabel}</span>
              </label>
            )}
            {error && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}

      {showShift && (
        <Modal
          title={editingShiftId ? t.payroll.editShiftTitle : t.payroll.addPaymentTitle}
          onClose={() => setShowShift(false)}
        >
          <form onSubmit={submitShift}>
            <div className="field">
              <label>{t.payroll.pickJob}</label>
              <select
                value={shiftForm.incomeScheduleId}
                disabled={!!editingShiftId}
                onChange={(e) => {
                  const job = activeJobs.find((j) => String(j.id) === e.target.value)
                  setShiftForm({ ...shiftForm, incomeScheduleId: e.target.value, hourlyRate: String(job?.hourlyRate ?? shiftForm.hourlyRate) })
                }}
              >
                <option value="">{t.payroll.pickJobPlaceholder}</option>
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name} · {j.payType === 'Hourly'
                      ? `${formatMoney(j.hourlyRate || 0, j.currency)}/${t.payroll.hoursShort}`
                      : t.payroll.payTypeFixed}
                  </option>
                ))}
              </select>
              {selectedShiftJob && (
                <div className="field-hint" style={{ marginTop: 6, marginBottom: 0 }}>
                  {isHourlySelected ? t.payroll.paymentKindHourly : t.payroll.paymentKindFixed}
                </div>
              )}
            </div>

            {isHourlySelected ? (
              <>
                <div className="field-row">
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t.common.date}</label>
                    <input
                      type="date" required
                      value={shiftForm.date}
                      onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t.payroll.hours}</label>
                    <input
                      type="number" step="0.25" min="0" max="24" required autoFocus
                      value={shiftForm.hours}
                      onChange={(e) => setShiftForm({ ...shiftForm, hours: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>{t.payroll.hourlyRate}</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={shiftForm.hourlyRate}
                    onChange={(e) => setShiftForm({ ...shiftForm, hourlyRate: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="insight" style={{ marginBottom: 12 }}>
                  {t.payroll.shiftEarnings}: <strong>{formatMoney(shiftPreview, selectedShiftJob?.currency || activeCurrency)}</strong>
                </div>
              </>
            ) : (
              <div className="field-row">
                <div className="field" style={{ flex: 1 }}>
                  <label>{t.common.date}</label>
                  <input
                    type="date" required
                    value={shiftForm.date}
                    onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })}
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>{t.common.amount}</label>
                  <input
                    type="number" step="0.01" min="0" required autoFocus
                    value={shiftForm.amount}
                    onChange={(e) => setShiftForm({ ...shiftForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {shiftError && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{shiftError}</div>}
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setShowShift(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={savingShift}>{savingShift ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}

      {showIncome && (
        <Modal title={t.dashboard.editIncomeTitle} onClose={() => setShowIncome(false)}>
          <form onSubmit={submitIncome}>
            <div className="field">
              <label>{t.payroll.pickJob}</label>
              <select
                value={incomeForm.incomeScheduleId}
                onChange={(e) => {
                  const job = activeJobs.find((j) => String(j.id) === e.target.value)
                  setIncomeForm({
                    ...incomeForm,
                    incomeScheduleId: e.target.value,
                    hourlyRate: job?.payType === 'Hourly' ? String(job.hourlyRate ?? incomeForm.hourlyRate) : incomeForm.hourlyRate,
                  })
                }}
              >
                <option value="">{t.payroll.pickJobPlaceholder}</option>
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                    {j.payType === 'Hourly' ? ` · ${formatMoney(j.hourlyRate || 0, j.currency)}/${t.payroll.hoursShort}` : ` · ${t.payroll.payTypeFixed}`}
                  </option>
                ))}
              </select>
            </div>
            {incomeIsHourly ? (
              <>
                <div className="field-row">
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t.payroll.hours}</label>
                    <input
                      type="number" step="0.25" min="0" required autoFocus
                      value={incomeForm.hours}
                      onChange={(e) => setIncomeForm({ ...incomeForm, hours: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t.payroll.hourlyRate}</label>
                    <input
                      type="number" step="0.01" min="0" required
                      value={incomeForm.hourlyRate}
                      onChange={(e) => setIncomeForm({ ...incomeForm, hourlyRate: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="insight" style={{ marginBottom: 12 }}>
                  {t.payroll.shiftEarnings}: <strong>{formatMoney(incomePreview, incomeForm.currency || activeCurrency)}</strong>
                </div>
              </>
            ) : (
              <div className="field-row">
                <div className="field" style={{ flex: 1 }}>
                  <label>{t.common.amount}</label>
                  <input
                    type="number" step="0.01" min="0" required autoFocus
                    value={incomeForm.amount}
                    onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>{t.common.currency}</label>
                  <div className="static-field">{incomeForm.currency || activeCurrency}</div>
                </div>
              </div>
            )}
            <div className="field">
              <label>{t.common.description}</label>
              <input
                type="text"
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                placeholder={t.dashboard.incomePlaceholder}
              />
            </div>
            <div className="field">
              <label>{t.common.date}</label>
              <input
                type="date" required
                value={incomeForm.date}
                onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{t.common.paymentMethod}</label>
              <select
                value={incomeForm.paymentMethodId}
                onChange={(e) => setIncomeForm({ ...incomeForm, paymentMethodId: e.target.value })}
              >
                <option value="">{t.common.none}</option>
                {paymentMethods
                  .filter((p) => !p.archived && p.type !== 'CreditCard'
                    && (p.currency === (incomeForm.currency || activeCurrency) || String(p.id) === String(incomeForm.paymentMethodId)))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{accountLabel(p.name)} · {pmTypeLabel(p.type)}</option>
                  ))}
              </select>
            </div>
            {incomeError && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{incomeError}</div>}
            <div className="row">
              <button
                type="button"
                className="btn danger"
                onClick={() => { setShowIncome(false); removeIncome({ id: editingIncomeId }) }}
              >
                {t.common.delete}
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn secondary" onClick={() => setShowIncome(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={savingIncome}>{savingIncome ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirm}
        message={confirm?.message}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await confirm.run()
          setConfirm(null)
        }}
      />
    </div>
  )
}
