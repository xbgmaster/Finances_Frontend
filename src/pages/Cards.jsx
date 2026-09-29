import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PaymentMethodsApi } from '../api/client'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import PageSpinner from '../components/PageSpinner'
import { useToast } from '../components/Toast'
import { tintVars, normalizeHex, sameColor, CARD_BANK_COLORS } from '../utils/color'
import { formatMoney, formatDate } from '../utils/format'
import { pmTypeIcon } from '../utils/icons'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const TYPES = ['Debit', 'Cash', 'CreditCard']

const TYPE_SECTIONS = [
  { type: 'Debit', titleKey: 'sectionDebit' },
  { type: 'Cash', titleKey: 'sectionCash' },
  { type: 'CreditCard', titleKey: 'sectionCreditCard' },
]

const emptyForm = {
  name: '',
  type: 'Debit',
  currency: '',
  color: '#0f5c4d',
  creditLimit: '',
  statementDay: '',
  paymentDueDay: '',
  archived: false,
  isFavorite: false,
}

function sortMethods(list) {
  return list.slice().sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

/** Current payment-due window for a credit card + whether a payment landed in it.
 *  Late payments still clear the past due (then the next cycle shows unpaid until another payment). */
function cardDueStatus(card, payments, today = new Date()) {
  const dueDay = card.paymentDueDay
  if (!dueDay) return null

  const startOfDay = (value) => {
    const d = value instanceof Date ? new Date(value) : new Date(value)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const clamp = (y, m, day) => {
    const dim = new Date(y, m + 1, 0).getDate()
    return startOfDay(new Date(y, m, Math.min(Math.max(1, day), dim)))
  }

  const today0 = startOfDay(today)
  let due = clamp(today0.getFullYear(), today0.getMonth(), dueDay)
  let prev = clamp(due.getFullYear(), due.getMonth() - 1, dueDay)
  let next = clamp(due.getFullYear(), due.getMonth() + 1, dueDay)

  // Chronological pool so each payment can only satisfy one cycle.
  const pool = (payments || [])
    .map((p) => startOfDay(p.date))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b)
  let payIdx = 0

  const consume = (allowLate) => {
    while (payIdx < pool.length) {
      const d = pool[payIdx]
      if (d <= prev) {
        payIdx += 1
        continue
      }
      // On-time / early for this due, or late but before the next due date.
      if (d <= due || (allowLate && d <= next)) {
        payIdx += 1
        return true
      }
      return false
    }
    return false
  }

  // Close past dues with on-time or late payments, advancing one cycle at a time.
  while (today0 > due) {
    if (!consume(true)) break
    prev = due
    due = next
    next = clamp(due.getFullYear(), due.getMonth() + 1, dueDay)
  }

  const paid = consume(today0 > due)
  const daysUntil = Math.round((due - today0) / 86400000)
  return { dueDate: due, paid, daysUntil, overdue: !paid && daysUntil < 0 }
}

function MethodCard({
  m, t, typeLabel, accountLabel, dueStatus, onFavorite, onPay, onDetails, onEdit, onDelete,
}) {
  const isCard = m.type === 'CreditCard'
  const limit = m.creditLimit ?? 0
  const usedPct = isCard && limit > 0 ? Math.min(100, (m.balance / limit) * 100) : 0

  return (
    <div
      className="card method-card"
      style={{ ...tintVars(m.color), opacity: m.archived ? 0.6 : 1 }}
    >
      <button
        type="button"
        className={`fav-star ${m.isFavorite ? 'on' : ''}`}
        title={m.isFavorite ? t.cards.favorite : t.cards.makeFavorite}
        aria-pressed={m.isFavorite}
        data-tour="cards-favorite"
        onClick={() => onFavorite(m)}
      >
        {m.isFavorite ? '⭐' : '☆'}
      </button>
      <div className="row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge-icon">
            {pmTypeIcon(m.type, { size: 22 })}
          </span>
          <div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              {accountLabel(m.name)}
              {m.archived && (
                <span
                  className="tag"
                  title={t.cards.archiveHint}
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                >
                  {t.cards.archivedBadge}
                </span>
              )}
            </div>
            <div className="hint" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {typeLabel(m.type)} · {m.currency}
            </div>
          </div>
        </div>
      </div>

      {isCard && dueStatus && !m.archived && (
        <div
          className={`card-due-banner ${dueStatus.paid ? 'paid' : dueStatus.overdue ? 'overdue' : 'pending'}`}
          role="status"
        >
          <span className="card-due-emoji" aria-hidden="true">{dueStatus.paid ? '🎉' : '⚠️'}</span>
          <div className="card-due-text">
            {dueStatus.paid ? (
              <>
                <strong>{t.cards.duePaidTitle}</strong>
                <span>{t.cards.duePaidBody.replace('{date}', formatDate(dueStatus.dueDate))}</span>
              </>
            ) : dueStatus.overdue ? (
              <>
                <strong>{t.cards.dueOverdueTitle}</strong>
                <span>{t.cards.dueOverdueBody.replace('{date}', formatDate(dueStatus.dueDate))}</span>
              </>
            ) : (
              <>
                <strong>{t.cards.duePendingTitle}</strong>
                <span>
                  {t.cards.duePendingBody
                    .replace('{date}', formatDate(dueStatus.dueDate))
                    .replace('{days}', String(Math.max(0, dueStatus.daysUntil)))}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {!isCard && (
          <div className="row" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t.cards.balance}</span>
            <strong className={m.balance < 0 ? 'neg' : 'pos'}>{formatMoney(m.balance, m.currency)}</strong>
          </div>
        )}

        <div className="row" style={{ fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>{t.cards.spentThisMonth}</span>
          <strong>{formatMoney(m.spentThisMonth, m.currency)}</strong>
        </div>

        {!isCard && m.receivedThisMonth > 0 && (
          <div className="row" style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>{t.cards.receivedThisMonth}</span>
            <strong className="pos">{formatMoney(m.receivedThisMonth, m.currency)}</strong>
          </div>
        )}

        {isCard && (
          <>
            <div className="row" style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{t.cards.used}</span>
              <span>{formatMoney(m.balance, m.currency)}{limit > 0 ? ` / ${formatMoney(limit, m.currency)}` : ''}</span>
            </div>
            {limit > 0 && (
              <>
                <div className="progress" style={{ marginTop: 4 }}>
                  <span style={{ width: `${usedPct}%`, background: usedPct >= 100 ? 'var(--danger)' : m.color }} />
                </div>
                <div className="row" style={{ fontSize: 13, marginTop: 2 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{t.cards.available}</span>
                  <strong className={m.availableCredit < 0 ? 'neg' : 'pos'}>
                    {formatMoney(m.availableCredit, m.currency)}
                  </strong>
                </div>
                {m.availableCredit < 0 && (
                  <div className="insight" style={{ borderColor: 'var(--danger)', marginTop: 8, fontSize: 13 }}>
                    ⚠️ {t.notifications.overLimitWarning}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
        {isCard && <button className="btn" onClick={() => onPay(m.id)}>{t.cards.payAction}</button>}
        <button className="btn secondary" onClick={() => onDetails(m.id)}>{t.cards.details}</button>
        <button className="btn secondary" onClick={() => onEdit(m)}>{t.common.edit}</button>
        <button
          className="btn danger"
          onClick={() => onDelete(m)}
        >
          {t.common.delete}
        </button>
      </div>
    </div>
  )
}

export default function Cards() {
  const { t, accountLabel } = useI18n()
  const navigate = useNavigate()
  const { currency: activeCurrency } = useCurrency()
  const toast = useToast()
  const [methods, setMethods] = useState([])
  const [cardPaymentsById, setCardPaymentsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [payCardId, setPayCardId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const list = await PaymentMethodsApi.list({ includeArchived: true })
      setMethods(list)
      const cards = list.filter((m) => m.type === 'CreditCard')
      const pairs = await Promise.all(
        cards.map(async (c) => [c.id, await PaymentMethodsApi.payments(c.id).catch(() => [])]),
      )
      setCardPaymentsById(Object.fromEntries(pairs))
      setListError('')
    } catch {
      setListError(t.cards.deleteError)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const typeLabel = (type) =>
    type === 'CreditCard' ? t.cards.typeCreditCard : type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, currency: activeCurrency })
    setError('')
    setShowModal(true)
  }

  const openEdit = (m) => {
    setEditing(m)
    setForm({
      name: m.name,
      type: m.type,
      currency: m.currency,
      color: normalizeHex(m.color),
      creditLimit: m.creditLimit ?? '',
      statementDay: m.statementDay ?? '',
      paymentDueDay: m.paymentDueDay ?? '',
      archived: m.archived,
      isFavorite: m.isFavorite,
    })
    setError('')
    setShowModal(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const isCard = form.type === 'CreditCard'
    const payload = {
      name: form.name.trim(),
      type: form.type,
      currency: form.currency || activeCurrency,
      color: normalizeHex(form.color),
      creditLimit: isCard && form.creditLimit !== '' ? parseFloat(form.creditLimit) : null,
      statementDay: isCard && form.statementDay !== '' ? parseInt(form.statementDay, 10) : null,
      paymentDueDay: isCard && form.paymentDueDay !== '' ? parseInt(form.paymentDueDay, 10) : null,
      archived: form.archived,
      isFavorite: form.isFavorite,
    }
    setError('')
    try {
      if (editing) await PaymentMethodsApi.update(editing.id, payload)
      else await PaymentMethodsApi.create(payload)
      setShowModal(false)
      await load()
      toast.success(t.common.savedOk)
    } catch (err) {
      setError(err?.response?.data?.message || t.cards.saveError)
    }
  }

  const remove = async (m) => {
    try {
      await PaymentMethodsApi.remove(m.id)
      await load()
      toast.success(t.common.deletedOk)
    } catch (err) {
      toast.error(err?.response?.data?.message || t.cards.deleteError)
    }
  }

  // One favorite at a time (the backend clears any previous favorite).
  const toggleFavorite = async (m) => {
    try {
      await PaymentMethodsApi.setFavorite(m.id, !m.isFavorite)
      await load()
    } catch (err) {
      toast.error(err?.response?.data?.message || t.cards.saveError)
    }
  }

  const dueByCard = useMemo(() => {
    const map = {}
    for (const m of methods) {
      if (m.type !== 'CreditCard') continue
      map[m.id] = cardDueStatus(m, cardPaymentsById[m.id] || [])
    }
    return map
  }, [methods, cardPaymentsById])

  if (loading) return <PageSpinner />

  // Only show methods in the active currency lens: paying/adding in another currency is
  // confusing and error-prone. Switch the currency at the top to see the others.
  const visibleMethods = methods.filter((m) => m.currency === activeCurrency)

  const sections = TYPE_SECTIONS
    .map((section) => ({
      ...section,
      items: sortMethods(visibleMethods.filter((m) => m.type === section.type)),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.cards.title}</h1>
          <p>{t.cards.subtitle}</p>
        </div>
        <button className="btn" data-tour="cards-add" onClick={openCreate}>{t.cards.newMethod}</button>
      </div>

      {listError && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>{listError}</div>}

      {methods.length === 0 ? (
        <div className="empty">{t.cards.empty}</div>
      ) : visibleMethods.length === 0 ? (
        <div className="empty">{t.cards.emptyCurrency.replace('{cur}', activeCurrency)}</div>
      ) : (
        sections.map((section, idx) => (
          <section className="method-section" key={section.type} {...(idx === 0 ? { 'data-tour': 'cards-section' } : {})}>
            <h2 className="section-title">
              <span aria-hidden="true" className="section-icon">{pmTypeIcon(section.type, { size: 18 })}</span>
              {t.cards[section.titleKey]}
              <span className="count">{section.items.length}</span>
            </h2>
            <div className="grid grid-3">
              {section.items.map((m) => (
                <MethodCard
                  key={m.id}
                  m={m}
                  t={t}
                  typeLabel={typeLabel}
                  accountLabel={accountLabel}
                  dueStatus={dueByCard[m.id]}
                  onFavorite={toggleFavorite}
                  onPay={setPayCardId}
                  onDetails={(id) => navigate(`/cards/${id}`)}
                  onEdit={openEdit}
                  onDelete={(method) => setConfirm({
                    message: t.cards.deleteConfirm.replace('{name}', accountLabel(method.name)),
                    run: () => remove(method),
                  })}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {payCardId && (
        <PayCardModal
          methods={methods}
          preselectedCardId={payCardId}
          onClose={() => setPayCardId(null)}
          onDone={async () => { setPayCardId(null); await load(); toast.success(t.common.savedOk) }}
        />
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

      {showModal && (
        <Modal title={editing ? t.cards.editTitle : t.cards.newTitle} onClose={() => setShowModal(false)}>
          <form onSubmit={submit}>
            {error && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

            <div className="field">
              <label>{t.cards.name}</label>
              <input
                type="text" autoFocus required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.cards.namePlaceholder}
              />
            </div>

            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.cards.type}</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((ty) => <option key={ty} value={ty}>{typeLabel(ty)}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.common.currency}</label>
                <div className="static-field" title={t.cards.currencyLensHint}>
                  {form.currency || activeCurrency}
                </div>
              </div>
            </div>

            {form.type === 'CreditCard' && (
              <>
                <div className="field">
                  <label>{t.cards.creditLimit} ({form.currency || activeCurrency})</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                    onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                    placeholder="0.00"
                  />
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t.cards.statementDay}</label>
                  <input
                    type="number" min="1" max="31" step="1"
                    value={form.statementDay}
                    onChange={(e) => setForm({ ...form, statementDay: e.target.value })}
                    onKeyDown={(e) => { if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                    placeholder="1-31"
                  />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>{t.cards.paymentDueDay}</label>
                  <input
                    type="number" min="1" max="31" step="1"
                    value={form.paymentDueDay}
                    onChange={(e) => setForm({ ...form, paymentDueDay: e.target.value })}
                    onKeyDown={(e) => { if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
                    placeholder="1-31"
                  />
                  </div>
                </div>
                <div className="hint" style={{ marginTop: -4, marginBottom: 8 }}>{t.cards.dayHint}</div>
              </>
            )}

            <div className="field">
              <label>{t.cards.color}</label>
              <div className="color-group">
                <span className="color-group-label">{t.cards.colorBank}</span>
                <div className="color-grid">
                  {CARD_BANK_COLORS.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={`color-pick ${sameColor(form.color, color) ? 'active' : ''}`}
                      style={{ background: color }}
                      title={color}
                      onClick={() => setForm({ ...form, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="color-group">
                <span className="color-group-label">{t.cards.colorCustom}</span>
                <div className="color-custom">
                  <input
                    type="color"
                    value={normalizeHex(form.color)}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    aria-label={t.cards.colorCustom}
                  />
                  <input
                    type="text"
                    value={form.color}
                    spellCheck={false}
                    maxLength={7}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    onBlur={() => setForm({ ...form, color: normalizeHex(form.color) })}
                  />
                </div>
              </div>
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isFavorite}
                  onChange={(e) => setForm({ ...form, isFavorite: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                {t.cards.favorite}
              </label>
              <div className="hint" style={{ marginTop: 4 }}>{t.cards.favoriteHint}</div>
            </div>

            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.archived}
                  onChange={(e) => setForm({ ...form, archived: e.target.checked })}
                  style={{ width: 'auto' }}
                />
                {t.cards.archived}
              </label>
              <div className="hint" style={{ marginTop: 4 }}>{t.cards.archiveHint}</div>
            </div>

            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn">{editing ? t.common.saveChanges : t.common.create}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
