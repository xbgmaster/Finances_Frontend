import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditsApi } from '../api/client'
import Modal from '../components/Modal'
import { formatMoney } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'

const today = () => new Date().toISOString().slice(0, 10)

const emptyCredit = {
  name: '',
  type: 'LibreInversion',
  principal: '',
  annualInterestRate: '',
  termMonths: '',
  startDate: today(),
  currency: '',
}

export default function Credits() {
  const { t } = useI18n()
  const [credits, setCredits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyCredit)

  const [payFor, setPayFor] = useState(null)
  const [paying, setPaying] = useState(false)
  const [payment, setPayment] = useState({ amount: '', date: today(), note: '' })

  const load = async () => {
    setLoading(true)
    setCredits(await CreditsApi.list())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setForm({ ...emptyCredit, startDate: today() })
    setError('')
    setShowCreate(true)
  }

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    try {
      await CreditsApi.create({
        name: form.name.trim(),
        type: form.type,
        principal: parseFloat(form.principal),
        annualInterestRate: parseFloat(form.annualInterestRate),
        termMonths: parseInt(form.termMonths, 10),
        startDate: new Date(form.startDate).toISOString(),
        currency: form.currency.trim() || null,
      })
      setShowCreate(false)
      await load()
    } finally {
      setCreating(false)
    }
  }

  const openPayment = (credit) => {
    setPayFor(credit)
    setPayment({ amount: '', date: today(), note: '' })
    setError('')
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    const amount = parseFloat(payment.amount)
    if (!amount || amount <= 0) return
    setPaying(true)
    try {
      await CreditsApi.addPayment(payFor.id, {
        amount,
        date: new Date(payment.date).toISOString(),
        note: payment.note.trim() || null,
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
                      {t.credits.types[c.type] || c.type} · {c.annualInterestRate}% · {c.termMonths} mo
                    </div>
                  </div>
                  <span className={`pill ${paidOff ? 'pill-user' : 'pill-admin'}`}>
                    {paidOff ? t.credits.statusPaidOff : t.credits.statusActive}
                  </span>
                </div>

                <div className="row" style={{ marginTop: 16 }}>
                  <div>
                    <div className="hint">{t.credits.outstanding}</div>
                    <div style={{ fontWeight: 700, fontSize: 20 }} className="amount neg">
                      {formatMoney(c.outstandingPrincipal)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="hint">{t.credits.monthlyInstallment}</div>
                    <div style={{ fontWeight: 600 }}>{formatMoney(c.monthlyInstallment)}</div>
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
                    {formatMoney(c.totalPaid)} / {formatMoney(c.totalToPay)}
                  </div>
                </div>

                <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
                  <Link className="btn secondary" to={`/credits/${c.id}`}>{t.credits.details}</Link>
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
        <Modal title={t.credits.createTitle} onClose={() => setShowCreate(false)}>
          <form onSubmit={submitCreate}>
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
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.keys(t.credits.types).map((key) => (
                  <option key={key} value={key}>{t.credits.types[key]}</option>
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
              <label>{t.credits.currency}</label>
              <input
                type="text" maxLength={3}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                placeholder="USD"
              />
              <div className="hint" style={{ marginTop: 6 }}>{t.credits.rateHint}</div>
            </div>

            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={creating}>{creating ? t.common.saving : t.common.create}</button>
            </div>
          </form>
        </Modal>
      )}

      {payFor && (
        <Modal title={`${t.credits.registerPayment} · ${payFor.name}`} onClose={() => setPayFor(null)}>
          <form onSubmit={submitPayment}>
            <div className="field">
              <label>{t.credits.paymentAmount}</label>
              <input
                type="number" step="0.01" min="0" autoFocus required
                value={payment.amount}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                placeholder={formatMoney(payFor.monthlyInstallment)}
              />
              <div className="hint" style={{ marginTop: 6 }}>
                {t.credits.monthlyInstallment}: {formatMoney(payFor.monthlyInstallment)}
              </div>
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
