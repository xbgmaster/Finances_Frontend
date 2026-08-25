import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CreditsApi } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import { formatMoney, formatDate } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'

const today = () => new Date().toISOString().slice(0, 10)
const emptyPayment = { amount: '', date: today(), note: '' }

export default function CreditDetail() {
  const { id } = useParams()
  const { t } = useI18n()
  const [summary, setSummary] = useState(null)
  const [schedule, setSchedule] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  // Payment modal handles both "add" (editing === null) and "edit" (editing = payment).
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyPayment)

  const load = async () => {
    setLoading(true)
    const [sum, sched, pays] = await Promise.all([
      CreditsApi.summary(id),
      CreditsApi.schedule(id),
      CreditsApi.payments(id),
    ])
    setSummary(sum)
    setSchedule(sched)
    setPayments(pays)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyPayment)
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({ amount: String(p.amount), date: p.date.slice(0, 10), note: p.note ?? '' })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return
    setSaving(true)
    try {
      const payload = {
        amount,
        date: new Date(form.date).toISOString(),
        note: form.note.trim() || null,
      }
      if (editing) await CreditsApi.updatePayment(id, editing.id, payload)
      else await CreditsApi.addPayment(id, payload)
      setModalOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const removePayment = async (p) => {
    if (!window.confirm(t.credits.paymentDeleteConfirm)) return
    await CreditsApi.removePayment(id, p.id)
    await load()
  }

  if (loading || !summary) return <div className="loading">{t.common.loading}</div>

  const paidOff = summary.status === 'PaidOff'

  return (
    <div>
      <div className="page-header row">
        <div>
          <Link to="/credits" className="hint" style={{ textDecoration: 'none' }}>{t.credits.back}</Link>
          <h1 style={{ marginTop: 6 }}>{summary.name}</h1>
          <p>
            {t.credits.types[summary.type] || summary.type} · {summary.annualInterestRate}% · {summary.termMonths} mo
            {' · '}{formatDate(summary.startDate)}
          </p>
        </div>
        <button className="btn" onClick={openAdd}>{t.credits.addPayment}</button>
      </div>

      <div className="grid grid-4">
        <StatCard
          label={t.credits.outstanding}
          value={summary.outstandingPrincipal}
          icon="🎯"
          color="#ef4444"
          tone="neg"
          hint={t.credits.outstandingHint}
        />
        <StatCard
          label={t.credits.savingsIfPaidOff}
          value={summary.savingsIfPaidOffToday}
          icon="💚"
          color="#10b981"
          tone="pos"
          hint={t.credits.savingsHint}
        />
        <StatCard label={t.credits.totalPaid} value={summary.totalPaid} icon="✅" color="#6366f1" />
        <StatCard label={t.credits.remainingTotal} value={summary.remainingTotal} icon="⏳" color="#f59e0b" />
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <StatCard label={t.credits.monthlyInstallment} value={summary.monthlyInstallment} icon="📅" color="#22d3ee" />
        <StatCard label={t.credits.totalToPay} value={summary.totalToPay} icon="🧾" color="#94a3c4" />
        <StatCard label={t.credits.totalInterest} value={summary.totalInterest} icon="📈" color="#ef4444" />
        <StatCard label={t.credits.principalPaid} value={summary.principalPaid} icon="🏦" color="#10b981" />
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>{t.credits.progress}</span>
          <span className="hint">
            {summary.installmentsCovered} / {summary.termMonths} {t.credits.installmentsProgress} · {summary.progressPercent}%
          </span>
        </div>
        <div className="progress">
          <span style={{ width: `${Math.min(100, summary.progressPercent)}%`, background: 'var(--success)' }} />
        </div>
      </div>

      <h2 className="section-title">{t.credits.paymentsTitle}</h2>
      {payments.length === 0 ? (
        <div className="empty">{t.credits.noPayments}</div>
      ) : (
        <div className="list">
          {payments.map((p) => (
            <div className="list-item" key={p.id}>
              <span className="badge-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>💵</span>
              <div className="meta">
                <div className="title">{formatMoney(p.amount)}</div>
                <div className="sub">{formatDate(p.date)}{p.note ? ` · ${p.note}` : ''}</div>
              </div>
              <button className="btn secondary" onClick={() => openEdit(p)}>{t.common.edit}</button>
              <button className="btn danger" onClick={() => removePayment(p)}>{t.common.delete}</button>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">{t.credits.schedule}</h2>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.credits.colNumber}</th>
              <th>{t.credits.colDueDate}</th>
              <th className="num">{t.credits.colInstallment}</th>
              <th className="num">{t.credits.colInterest}</th>
              <th className="num">{t.credits.colPrincipal}</th>
              <th className="num">{t.credits.colBalance}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((r) => {
              const isPaid = r.number <= summary.installmentsCovered
              return (
                <tr key={r.number}>
                  <td>{r.number}</td>
                  <td>{formatDate(r.dueDate)}</td>
                  <td className="num">{formatMoney(r.installment)}</td>
                  <td className="num">{formatMoney(r.interest)}</td>
                  <td className="num">{formatMoney(r.principal)}</td>
                  <td className="num">{formatMoney(r.remainingBalance)}</td>
                  <td>{isPaid && <span className="pill pill-user">{t.credits.paid}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal
          title={`${editing ? t.credits.editPayment : t.credits.registerPayment} · ${summary.name}`}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={submit}>
            <div className="field">
              <label>{t.credits.paymentAmount}</label>
              <input
                type="number" step="0.01" min="0" autoFocus required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder={formatMoney(summary.monthlyInstallment)}
              />
              <div className="hint" style={{ marginTop: 6 }}>
                {t.credits.monthlyInstallment}: {formatMoney(summary.monthlyInstallment)}
              </div>
            </div>
            <div className="field">
              <label>{t.credits.paymentDate}</label>
              <input
                type="date" required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{t.credits.paymentNote}</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder={t.credits.paymentNotePlaceholder}
              />
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setModalOpen(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? t.common.saving : (editing ? t.credits.saveChanges : t.credits.registerPayment)}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
