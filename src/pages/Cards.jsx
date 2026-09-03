import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PaymentMethodsApi } from '../api/client'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import PayCardModal from '../components/PayCardModal'
import { tintVars, normalizeHex, sameColor, CARD_BANK_COLORS, CARD_EXTRA_COLORS } from '../utils/color'
import { formatMoney } from '../utils/format'
import { CURRENCIES } from '../utils/currencies'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const TYPES = ['Debit', 'Cash', 'CreditCard']

const TYPE_SECTIONS = [
  { type: 'Debit', titleKey: 'sectionDebit', icon: '🏦' },
  { type: 'Cash', titleKey: 'sectionCash', icon: '💵' },
  { type: 'CreditCard', titleKey: 'sectionCreditCard', icon: '💳' },
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

const typeIcon = (type) => (type === 'CreditCard' ? '💳' : type === 'Cash' ? '💵' : '🏦')

function sortMethods(list) {
  return list.slice().sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

function MethodCard({
  m, t, typeLabel, onFavorite, onPay, onDetails, onEdit, onDelete,
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
        onClick={() => onFavorite(m)}
      >
        {m.isFavorite ? '⭐' : '☆'}
      </button>
      <div className="row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge-icon">
            {typeIcon(m.type)}
          </span>
          <div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              {m.name}
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
  const { t } = useI18n()
  const navigate = useNavigate()
  const { currency: activeCurrency } = useCurrency()
  const [methods, setMethods] = useState([])
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
      setMethods(await PaymentMethodsApi.list({ includeArchived: true }))
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
    } catch (err) {
      setError(err?.response?.data?.message || t.cards.saveError)
    }
  }

  const remove = async (m) => {
    setListError('')
    try {
      await PaymentMethodsApi.remove(m.id)
      await load()
    } catch (err) {
      setListError(err?.response?.data?.message || t.cards.deleteError)
    }
  }

  // One favorite at a time (the backend clears any previous favorite).
  const toggleFavorite = async (m) => {
    setListError('')
    try {
      await PaymentMethodsApi.setFavorite(m.id, !m.isFavorite)
      await load()
    } catch (err) {
      setListError(err?.response?.data?.message || t.cards.saveError)
    }
  }

  if (loading) return <div className="loading">{t.common.loading}</div>

  const sections = TYPE_SECTIONS
    .map((section) => ({
      ...section,
      items: sortMethods(methods.filter((m) => m.type === section.type)),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.cards.title}</h1>
          <p>{t.cards.subtitle}</p>
        </div>
        <button className="btn" onClick={openCreate}>{t.cards.newMethod}</button>
      </div>

      {listError && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>{listError}</div>}

      {methods.length === 0 ? (
        <div className="empty">{t.cards.empty}</div>
      ) : (
        sections.map((section) => (
          <section className="method-section" key={section.type}>
            <h2 className="section-title">
              <span aria-hidden="true">{section.icon}</span>
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
                  onFavorite={toggleFavorite}
                  onPay={setPayCardId}
                  onDetails={(id) => navigate(`/cards/${id}`)}
                  onEdit={openEdit}
                  onDelete={(method) => setConfirm({
                    message: t.cards.deleteConfirm.replace('{name}', method.name),
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
          onDone={async () => { setPayCardId(null); await load() }}
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
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
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
                    placeholder="0.00"
                  />
                </div>
                <div className="row" style={{ gap: 12 }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t.cards.statementDay}</label>
                    <input
                      type="number" min="1" max="31"
                      value={form.statementDay}
                      onChange={(e) => setForm({ ...form, statementDay: e.target.value })}
                      placeholder="1-31"
                    />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>{t.cards.paymentDueDay}</label>
                    <input
                      type="number" min="1" max="31"
                      value={form.paymentDueDay}
                      onChange={(e) => setForm({ ...form, paymentDueDay: e.target.value })}
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
                <span className="color-group-label">{t.cards.colorPalette}</span>
                <div className="color-grid">
                  {CARD_EXTRA_COLORS.map((color) => (
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
