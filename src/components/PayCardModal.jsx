import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import { PaymentMethodsApi } from '../api/client'
import { formatMoney } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'

const todayIso = () => new Date().toISOString().slice(0, 10)

// Modal to pay down a credit card. Money can come from a cash/debit account (reduces its
// balance) or be cash/money outside saved accounts (only reduces the card debt). Both free up cupo.
export default function PayCardModal({ methods, preselectedCardId, onClose, onDone }) {
  const { t } = useI18n()

  const cards = useMemo(
    () => methods.filter((m) => m.type === 'CreditCard' && !m.archived),
    [methods],
  )

  const [cardId, setCardId] = useState(
    preselectedCardId ? String(preselectedCardId) : String(cards[0]?.id ?? ''),
  )
  const [form, setForm] = useState({ amount: '', sourceId: '', date: todayIso(), note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const card = cards.find((c) => String(c.id) === String(cardId))
  const cardCurrency = card?.currency

  // Only cash/debit accounts in the same currency can fund the payment.
  const sources = methods.filter(
    (m) => m.type !== 'CreditCard' && !m.archived && m.currency === cardCurrency,
  )

  const fillOwed = () => {
    if (card?.balance == null) return
    setForm((f) => ({ ...f, amount: String(card.balance) }))
  }

  useEffect(() => {
    fillOwed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, card?.balance])

  const sourceTypeLabel = (type) =>
    type === 'Cash' ? t.cards.typeCash : type === 'Debit' ? t.cards.typeDebit : type

  const submit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!card || !amount || amount <= 0) return
    setSaving(true)
    setError('')
    try {
      await PaymentMethodsApi.payCard(card.id, {
        amount,
        sourcePaymentMethodId: form.sourceId ? Number(form.sourceId) : undefined,
        date: form.date ? new Date(form.date).toISOString() : undefined,
        note: form.note.trim() || undefined,
      })
      onDone?.()
    } catch (err) {
      setError(err?.response?.data?.message || t.cards.payError)
      setSaving(false)
    }
  }

  return (
    <Modal title={t.cards.payTitle} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

        <div className="field">
          <label>{t.cards.payCardLabel}</label>
          <select
            value={cardId}
            onChange={(e) => { setCardId(e.target.value); setForm((f) => ({ ...f, sourceId: '' })) }}
            disabled={!!preselectedCardId}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.currency}</option>
            ))}
          </select>
        </div>

        {card && (
          <button type="button" className="owed-fill" onClick={fillOwed}>
            <span>
              {t.cards.owed}: <strong>{formatMoney(card.balance, cardCurrency)}</strong>
            </span>
            {card.availableCredit != null && (
              <span> · {t.cards.available}: <strong>{formatMoney(card.availableCredit, cardCurrency)}</strong></span>
            )}
            <span className="owed-fill-hint">{t.cards.useOwedAmount}</span>
          </button>
        )}

        <div className="field">
          <label>{t.common.amount} {cardCurrency ? `(${cardCurrency})` : ''}</label>
          <input
            type="number" step="0.01" min="0" autoFocus required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="field">
          <label>{t.cards.payFrom}</label>
          <select value={form.sourceId} onChange={(e) => setForm({ ...form, sourceId: e.target.value })}>
            <option value="">{t.cards.payExternal}</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {sourceTypeLabel(s.type)} · {s.name} · {formatMoney(s.balance, s.currency)}
              </option>
            ))}
          </select>
          <div className="hint" style={{ marginTop: 4 }}>
            {form.sourceId ? t.cards.payFromHint : t.cards.payExternalHint}
          </div>
        </div>

        <div className="field">
          <label>{t.common.date}</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <div className="field">
          <label>{t.common.description}</label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder={t.common.optional}
          />
        </div>

        <div className="row">
          <button type="button" className="btn secondary" onClick={onClose}>{t.common.cancel}</button>
          <button type="submit" className="btn" disabled={saving || !card}>
            {saving ? t.common.saving : t.cards.payAction}
          </button>
        </div>
      </form>
    </Modal>
  )
}
