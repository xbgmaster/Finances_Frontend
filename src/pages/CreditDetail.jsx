import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CreditsApi } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import { formatMoney, formatDate } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'

const today = () => new Date().toISOString().slice(0, 10)
const emptyPayment = { amount: '', date: today(), note: '', type: 'Installment', effect: 'ReduceTerm' }

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
    setForm({ ...emptyPayment, effect: summary?.prepaymentEffect || 'ReduceTerm' })
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      amount: String(p.amount),
      date: p.date.slice(0, 10),
      note: p.note ?? '',
      type: p.type || 'Installment',
      effect: p.effect || summary?.prepaymentEffect || 'ReduceTerm',
    })
    setModalOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return
    setSaving(true)
    try {
      const isPrepayment = form.type === 'PrincipalPrepayment'
      const payload = {
        amount,
        date: new Date(form.date).toISOString(),
        note: form.note.trim() || null,
        type: form.type,
        effect: isPrepayment ? form.effect : null,
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
  const cur = summary.currency

  const fillMsg = (tpl) =>
    tpl
      .replace('{days}', String(Math.abs(summary.daysUntilDue)))
      .replace('{date}', formatDate(summary.nextDueDate))

  const dueBanner = () => {
    if (paidOff) return null
    const a = t.credits.alerts
    if (summary.isOverdue) {
      return (
        <div className="alert-banner alert-overdue">
          <span className="alert-icon">⚠️</span>
          <div><strong>{a.overdue}.</strong> {fillMsg(a.overdueMsg)}</div>
        </div>
      )
    }
    if (summary.isDueSoon) {
      const dueToday = summary.daysUntilDue === 0
      return (
        <div className="alert-banner alert-duesoon">
          <span className="alert-icon">⏰</span>
          <div>
            <strong>{dueToday ? a.dueToday : a.dueSoon}.</strong>{' '}
            {fillMsg(dueToday ? a.dueTodayMsg : a.dueSoonMsg)}
          </div>
        </div>
      )
    }
    return (
      <div className="alert-banner alert-ok">
        <span className="alert-icon">✅</span>
        <div><strong>{a.upToDate}.</strong> {a.nextDue}: {formatDate(summary.nextDueDate)}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header row">
        <div>
          <Link to="/credits" className="hint" style={{ textDecoration: 'none' }}>{t.credits.back}</Link>
          <h1 style={{ marginTop: 6 }}>{summary.name}</h1>
          <p>
            {t.credits.types[summary.type] || summary.type}
            {' · '}{t.credits.interestModels[summary.interestModel] || summary.interestModel}
            {' · '}{summary.annualInterestRate}% · {summary.effectiveAnnualRate}% APR · {summary.termMonths} mo
            {cur ? ` · ${cur}` : ''}
            {' · '}{formatDate(summary.startDate)}
            {' · '}{t.credits.alerts.dueDayLabel} {summary.paymentDueDay}
          </p>
        </div>
        <button className="btn" onClick={openAdd}>{t.credits.addPayment}</button>
      </div>

      {dueBanner()}

      <div className="grid grid-4">
        <StatCard
          label={t.credits.payoffToday}
          value={summary.payoffAmountToday}
          icon="🎯"
          color="#ef4444"
          tone="neg"
          currency={cur}
          hint={summary.prepaymentPenaltyAmount > 0
            ? `${t.credits.penaltyAmount}: ${formatMoney(summary.prepaymentPenaltyAmount, cur)}`
            : t.credits.payoffTodayHint}
        />
        <StatCard
          label={t.credits.savingsIfPaidOff}
          value={summary.netSavingsIfPaidOffToday}
          icon="💚"
          color="#10b981"
          tone="pos"
          currency={cur}
          hint={t.credits.savingsHint}
        />
        <StatCard label={t.credits.totalPaid} value={summary.totalPaid} icon="✅" color="#6366f1" currency={cur} />
        <StatCard label={t.credits.remainingTotal} value={summary.remainingTotal} icon="⏳" color="#f59e0b" currency={cur} />
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <StatCard label={t.credits.monthlyInstallment} value={summary.monthlyInstallment} icon="📅" color="#22d3ee" currency={cur} />
        <StatCard label={t.credits.totalToPay} value={summary.totalToPay} icon="🧾" color="#94a3c4" currency={cur} />
        <StatCard label={t.credits.totalInterest} value={summary.totalInterest} icon="📈" color="#ef4444" currency={cur} />
        <StatCard label={t.credits.principalPaid} value={summary.principalPaid} icon="🏦" color="#10b981" currency={cur} />
      </div>

      {summary.prepaidPrincipal > 0 && (
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          <StatCard
            label={t.credits.prepaidPrincipal}
            value={summary.prepaidPrincipal}
            icon="⚡"
            color="#a855f7"
            currency={cur}
            hint={t.credits.prepaidHint}
          />
        </div>
      )}

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
                <div className="title">
                  {formatMoney(p.amount, cur)}
                  {p.type === 'PrincipalPrepayment' && (
                    <span className="pill pill-admin" style={{ marginLeft: 8 }}>
                      {t.credits.prepaymentBadge}{p.effect ? ` · ${t.credits.prepaymentEffects[p.effect] || p.effect}` : ''}
                    </span>
                  )}
                </div>
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
                  <td className="num">{formatMoney(r.installment, cur)}</td>
                  <td className="num">{formatMoney(r.interest, cur)}</td>
                  <td className="num">{formatMoney(r.principal, cur)}</td>
                  <td className="num">{formatMoney(r.remainingBalance, cur)}</td>
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
              <label>{t.credits.paymentType}</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.keys(t.credits.paymentTypes).map((key) => (
                  <option key={key} value={key}>{t.credits.paymentTypes[key]}</option>
                ))}
              </select>
            </div>
            {form.type === 'PrincipalPrepayment' && (
              <div className="field">
                <label>{t.credits.paymentEffect}</label>
                <select value={form.effect} onChange={(e) => setForm({ ...form, effect: e.target.value })}>
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
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder={formatMoney(summary.monthlyInstallment, cur)}
              />
              {form.type === 'Installment' && (
                <div className="hint" style={{ marginTop: 6 }}>
                  {t.credits.monthlyInstallment}: {formatMoney(summary.monthlyInstallment, cur)}
                </div>
              )}
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
