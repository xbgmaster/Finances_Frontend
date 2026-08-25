import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditsApi } from '../api/client'
import Modal from '../components/Modal'
import { formatMoney, formatDate, getBaseCurrency } from '../utils/format'
import { CURRENCIES } from '../utils/currencies'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const today = () => new Date().toISOString().slice(0, 10)
const currentDay = () => String(new Date().getDate())

const emptyCredit = {
  name: '',
  type: 'LibreInversion',
  interestModel: 'CompoundFrench',
  prepaymentEffect: 'ReduceTerm',
  prepaymentPenaltyRate: '',
  principal: '',
  annualInterestRate: '',
  termMonths: '',
  startDate: today(),
  paymentDueDay: currentDay(),
  currency: '',
}

export default function Credits() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { currency: activeCurrency } = useCurrency()
  const baseCurrency = user?.currency || getBaseCurrency()
  const [credits, setCredits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyCredit)

  const [payFor, setPayFor] = useState(null)
  const [paying, setPaying] = useState(false)
  const [payment, setPayment] = useState({ amount: '', date: today(), note: '', type: 'Installment', effect: 'ReduceTerm' })

  const load = async () => {
    setLoading(true)
    setCredits(await CreditsApi.list({ currency: activeCurrency }))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCurrency])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyCredit, startDate: today(), paymentDueDay: currentDay(), currency: activeCurrency })
    setError('')
    setShowCreate(true)
  }

  const openEdit = (c) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      type: c.type,
      interestModel: c.interestModel,
      prepaymentEffect: c.prepaymentEffect || 'ReduceTerm',
      prepaymentPenaltyRate: c.prepaymentPenaltyRate ? String(c.prepaymentPenaltyRate) : '',
      principal: String(c.principal),
      annualInterestRate: String(c.annualInterestRate),
      termMonths: String(c.termMonths),
      startDate: c.startDate.slice(0, 10),
      paymentDueDay: String(c.paymentDueDay),
      currency: c.currency || baseCurrency,
    })
    setError('')
    setShowCreate(true)
  }

  const submitForm = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        interestModel: form.interestModel,
        prepaymentEffect: form.prepaymentEffect,
        prepaymentPenaltyRate: form.prepaymentPenaltyRate === '' ? 0 : parseFloat(form.prepaymentPenaltyRate),
        principal: parseFloat(form.principal),
        annualInterestRate: parseFloat(form.annualInterestRate),
        termMonths: parseInt(form.termMonths, 10),
        startDate: new Date(form.startDate).toISOString(),
        paymentDueDay: parseInt(form.paymentDueDay, 10),
        currency: form.currency.trim() || null,
      }
      if (editingId) await CreditsApi.update(editingId, payload)
      else await CreditsApi.create(payload)
      setShowCreate(false)
      await load()
    } finally {
      setCreating(false)
    }
  }

  const openPayment = (credit) => {
    setPayFor(credit)
    setPayment({ amount: '', date: today(), note: '', type: 'Installment', effect: credit.prepaymentEffect || 'ReduceTerm' })
    setError('')
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    const amount = parseFloat(payment.amount)
    if (!amount || amount <= 0) return
    setPaying(true)
    try {
      const isPrepayment = payment.type === 'PrincipalPrepayment'
      await CreditsApi.addPayment(payFor.id, {
        amount,
        date: new Date(payment.date).toISOString(),
        note: payment.note.trim() || null,
        type: payment.type,
        effect: isPrepayment ? payment.effect : null,
      })
      setPayFor(null)
      await load()
    } finally {
      setPaying(false)
    }
  }

  const remove = async (credit) => {
    if (!window.confirm(t.credits.deleteConfirm)) return
    setError('')
    try {
      await CreditsApi.remove(credit.id)
      await load()
    } catch (err) {
      setError(err?.response?.data?.detail || t.credits.deleteError)
    }
  }

  const alertPill = (c) => {
    if (c.status === 'PaidOff') return null
    if (c.isOverdue) return <span className="pill pill-over">{t.credits.alerts.overdue}</span>
    if (c.isDueSoon) return <span className="pill pill-due">{t.credits.alerts.dueSoon}</span>
    return null
  }

  // Outstanding debt grouped by currency (Level A: we never sum across currencies).
  const debtByCurrency = credits
    .filter((c) => c.status !== 'PaidOff')
    .reduce((acc, c) => {
      const cur = c.currency || baseCurrency
      acc[cur] = (acc[cur] || 0) + c.outstandingPrincipal
      return acc
    }, {})
  const debtEntries = Object.entries(debtByCurrency).filter(([, v]) => v > 0)

  if (loading) return <div className="loading">{t.common.loading}</div>

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.credits.title} 🏦</h1>
          <p>{t.credits.subtitle}</p>
        </div>
        <button className="btn" onClick={openCreate}>{t.credits.newCredit}</button>
      </div>

      {error && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      {debtEntries.length > 0 && (
        <div className="currency-totals">
          <span className="hint">{t.credits.totalDebt}</span>
          {debtEntries.map(([cur, val]) => (
            <span className="pill pill-admin" key={cur}>{formatMoney(val, cur)}</span>
          ))}
        </div>
      )}

      {credits.length === 0 ? (
        <div className="empty">{t.credits.noCredits}</div>
      ) : (
        <div className="grid grid-2">
          {credits.map((c) => {
            const paidOff = c.status === 'PaidOff'
            return (
              <div className="card" key={c.id}>
                <div className="row">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{c.name}</div>
                    <div className="hint" style={{ marginTop: 2 }}>
                      {t.credits.types[c.type] || c.type} · {(t.credits.interestModels[c.interestModel] || c.interestModel)} · {c.annualInterestRate}% · {c.termMonths} mo
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <span className={`pill ${paidOff ? 'pill-user' : 'pill-admin'}`}>
                      {paidOff ? t.credits.statusPaidOff : t.credits.statusActive}
                    </span>
                    {alertPill(c)}
                  </div>
                </div>

                <div className="row" style={{ marginTop: 16 }}>
                  <div>
                    <div className="hint">{t.credits.outstanding}</div>
                    <div style={{ fontWeight: 700, fontSize: 20 }} className="amount neg">
                      {formatMoney(c.outstandingPrincipal, c.currency)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="hint">{t.credits.monthlyInstallment}</div>
                    <div style={{ fontWeight: 600 }}>{formatMoney(c.monthlyInstallment, c.currency)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <span className="hint">{t.credits.progress}</span>
                    <span className="hint">{c.progressPercent}%</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${Math.min(100, c.progressPercent)}%`, background: 'var(--success)' }} />
                  </div>
                  <div className="hint" style={{ marginTop: 6 }}>
                    {formatMoney(c.totalPaid, c.currency)} / {formatMoney(c.totalToPay, c.currency)}
                  </div>
                </div>

                {!paidOff && (
                  <div
                    className="hint"
                    style={{
                      marginTop: 12,
                      color: c.isOverdue ? 'var(--danger)' : c.isDueSoon ? '#f59e0b' : 'var(--text-muted)',
                    }}
                  >
                    {c.isOverdue ? '⚠️ ' : c.isDueSoon ? '⏰ ' : '📅 '}
                    {t.credits.alerts.nextDue}: {formatDate(c.nextDueDate)}
                    {c.isOverdue
                      ? ` · ${t.credits.alerts.overdue} (${Math.abs(c.daysUntilDue)})`
                      : c.isDueSoon
                        ? ` · ${c.daysUntilDue === 0 ? t.credits.alerts.dueToday : `${c.daysUntilDue}d`}`
                        : ''}
                  </div>
                )}

                <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
                  <Link className="btn secondary" to={`/credits/${c.id}`}>{t.credits.details}</Link>
                  <button className="btn secondary" onClick={() => openEdit(c)}>{t.common.edit}</button>
                  {!paidOff && (
                    <button className="btn" onClick={() => openPayment(c)}>{t.credits.addPayment}</button>
                  )}
                  <button className="btn danger" onClick={() => remove(c)}>{t.common.delete}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <Modal title={editingId ? t.credits.editTitle : t.credits.createTitle} onClose={() => setShowCreate(false)}>
          <form onSubmit={submitForm}>
            <div className="field">
              <label>{t.credits.name}</label>
              <input
                type="text" autoFocus required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.credits.namePlaceholder}
              />
            </div>

            <div className="field">
              <label>{t.credits.type}</label>
              <select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value
                  setForm((f) => ({
                    ...f,
                    type,
                    // Credit cards are modeled as flat installment purchases; loans default to French.
                    interestModel: type === 'CreditCard'
                      ? 'SimpleFlat'
                      : (f.type === 'CreditCard' ? 'CompoundFrench' : f.interestModel),
                  }))
                }}
              >
                {Object.keys(t.credits.types).map((key) => (
                  <option key={key} value={key}>{t.credits.types[key]}</option>
                ))}
              </select>
            </div>

            {form.type === 'CreditCard' ? (
              <div className="hint" style={{ marginTop: -8, marginBottom: 16 }}>{t.credits.cardModelNote}</div>
            ) : (
              <div className="field">
                <label>{t.credits.interestModel}</label>
                <select value={form.interestModel} onChange={(e) => setForm({ ...form, interestModel: e.target.value })}>
                  {Object.keys(t.credits.interestModels).map((key) => (
                    <option key={key} value={key}>{t.credits.interestModels[key]}</option>
                  ))}
                </select>
                <div className="hint" style={{ marginTop: 6 }}>{t.credits.interestModelHint}</div>
              </div>
            )}

            <div className="field">
              <label>{t.credits.prepaymentEffect}</label>
              <select value={form.prepaymentEffect} onChange={(e) => setForm({ ...form, prepaymentEffect: e.target.value })}>
                {Object.keys(t.credits.prepaymentEffects).map((key) => (
                  <option key={key} value={key}>{t.credits.prepaymentEffects[key]}</option>
                ))}
              </select>
            </div>

            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.credits.principal}</label>
                <input
                  type="number" step="0.01" min="0" required
                  value={form.principal}
                  onChange={(e) => setForm({ ...form, principal: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.credits.annualRate}</label>
                <input
                  type="number" step="0.01" min="0" required
                  value={form.annualInterestRate}
                  onChange={(e) => setForm({ ...form, annualInterestRate: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.credits.termMonths}</label>
                <input
                  type="number" step="1" min="1" required
                  value={form.termMonths}
                  onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                  placeholder="24"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.credits.startDate}</label>
                <input
                  type="date" required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label>{t.credits.paymentDueDay}</label>
              <input
                type="number" step="1" min="1" max="31" required
                value={form.paymentDueDay}
                onChange={(e) => setForm({ ...form, paymentDueDay: e.target.value })}
                placeholder="5"
              />
              <div className="hint" style={{ marginTop: 6 }}>{t.credits.paymentDueDayHint}</div>
            </div>

            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.credits.currency}</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  required
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.credits.penaltyRate}</label>
                <input
                  type="number" step="0.01" min="0" max="100"
                  value={form.prepaymentPenaltyRate}
                  onChange={(e) => setForm({ ...form, prepaymentPenaltyRate: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="hint" style={{ marginBottom: 16 }}>{t.credits.penaltyRateHint}</div>

            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={creating}>
                {creating ? t.common.saving : (editingId ? t.common.save : t.common.create)}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payFor && (
        <Modal title={`${t.credits.registerPayment} · ${payFor.name}`} onClose={() => setPayFor(null)}>
          <form onSubmit={submitPayment}>
            <div className="field">
              <label>{t.credits.paymentType}</label>
              <select value={payment.type} onChange={(e) => setPayment({ ...payment, type: e.target.value })}>
                {Object.keys(t.credits.paymentTypes).map((key) => (
                  <option key={key} value={key}>{t.credits.paymentTypes[key]}</option>
                ))}
              </select>
            </div>
            {payment.type === 'PrincipalPrepayment' && (
              <div className="field">
                <label>{t.credits.paymentEffect}</label>
                <select value={payment.effect} onChange={(e) => setPayment({ ...payment, effect: e.target.value })}>
                  {Object.keys(t.credits.prepaymentEffects).map((key) => (
                    <option key={key} value={key}>{t.credits.prepaymentEffects[key]}</option>
                  ))}
                </select>
                <div className="hint" style={{ marginTop: 6 }}>{t.credits.paymentEffectHint}</div>
              </div>
            )}
            <div className="field">
              <label>{t.credits.paymentAmount}</label>
              <input
                type="number" step="0.01" min="0" autoFocus required
                value={payment.amount}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                placeholder={formatMoney(payFor.monthlyInstallment, payFor.currency)}
              />
              {payment.type === 'Installment' && (
                <div className="hint" style={{ marginTop: 6 }}>
                  {t.credits.monthlyInstallment}: {formatMoney(payFor.monthlyInstallment, payFor.currency)}
                </div>
              )}
            </div>
            <div className="field">
              <label>{t.credits.paymentDate}</label>
              <input
                type="date" required
                value={payment.date}
                onChange={(e) => setPayment({ ...payment, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{t.credits.paymentNote}</label>
              <input
                type="text"
                value={payment.note}
                onChange={(e) => setPayment({ ...payment, note: e.target.value })}
                placeholder={t.credits.paymentNotePlaceholder}
              />
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setPayFor(null)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={paying}>{paying ? t.common.saving : t.credits.registerPayment}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
