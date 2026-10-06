import { useEffect, useState } from 'react'
import { Repeat } from 'lucide-react'
import { ExpenseSchedulesApi, CategoriesApi, PaymentMethodsApi } from '../api/client'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'
import { formatMoney, formatDate } from '../utils/format'
import { iconFor, pmTypeIcon } from '../utils/icons'
import { tintVars } from '../utils/color'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'
import PageSpinner from './PageSpinner'
import AccountOptionGroups from './AccountOptionGroups'

const emptyForm = {
  name: '', amount: '', categoryId: '', paymentMethodId: '',
  payFrequency: 'Monthly', dayOfMonth: '28', secondDayOfMonth: '', autoPost: true, active: true,
}

export default function SubscriptionsPanel() {
  const { t, categoryLabel, accountLabel } = useI18n()
  const { currency: activeCurrency } = useCurrency()
  const toast = useToast()

  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    try { await ExpenseSchedulesApi.postDue() } catch { /* non-critical */ }
    const [list, cats, pms] = await Promise.all([
      ExpenseSchedulesApi.list().catch(() => []),
      CategoriesApi.list().catch(() => []),
      PaymentMethodsApi.list().catch(() => []),
    ])
    setItems(list.filter((s) => s.currency === activeCurrency))
    setCategories(cats)
    setPaymentMethods(pms.filter((p) => !p.archived && p.currency === activeCurrency))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCurrency])

  const pmLabel = (p) => {
    const type = p.type === 'CreditCard' ? t.cards.typeCreditCard
      : p.type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit
    return `${accountLabel(p.name)} · ${type}`
  }

  const openCreate = () => {
    setEditingId(null)
    setError('')
    const defaultCat = categories.find((c) => !c.isSystem)?.id ?? categories[0]?.id ?? ''
    const defaultPm = paymentMethods.find((p) => p.isFavorite)?.id ?? paymentMethods[0]?.id ?? ''
    setForm({
      ...emptyForm,
      categoryId: String(defaultCat),
      paymentMethodId: String(defaultPm),
      dayOfMonth: String(new Date().getDate()),
    })
    setShowModal(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setError('')
    setForm({
      name: s.name,
      amount: String(s.amount),
      categoryId: String(s.categoryId),
      paymentMethodId: String(s.paymentMethodId),
      payFrequency: s.payFrequency || 'Monthly',
      dayOfMonth: String(s.dayOfMonth),
      secondDayOfMonth: s.secondDayOfMonth != null ? String(s.secondDayOfMonth) : '',
      autoPost: !!s.autoPost,
      active: !!s.active,
    })
    setShowModal(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    const day = parseInt(form.dayOfMonth, 10)
    if (!form.name.trim() || !amount || amount <= 0 || !form.categoryId || !form.paymentMethodId || !day) {
      setError(t.subscriptions.formError)
      return
    }
    if (form.payFrequency === 'SemiMonthly') {
      const second = parseInt(form.secondDayOfMonth, 10)
      if (!second || second <= day) {
        setError(t.subscriptions.secondDayError)
        return
      }
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        amount,
        currency: activeCurrency,
        categoryId: Number(form.categoryId),
        paymentMethodId: Number(form.paymentMethodId),
        payFrequency: form.payFrequency,
        dayOfMonth: day,
        secondDayOfMonth: form.payFrequency === 'SemiMonthly' ? Number(form.secondDayOfMonth) : undefined,
        autoPost: form.autoPost,
        ...(editingId ? { active: form.active } : {}),
      }
      if (editingId) await ExpenseSchedulesApi.update(editingId, payload)
      else await ExpenseSchedulesApi.create(payload)
      setShowModal(false)
      await load()
      toast.success(t.common.savedOk)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    try {
      await ExpenseSchedulesApi.remove(id)
      await load()
      toast.success(t.common.deletedOk)
    } catch (err) {
      toast.error(err?.response?.data?.message || t.expenses.deleteError)
    }
  }

  const freqLabel = (f) =>
    f === 'SemiMonthly' ? t.subscriptions.freqSemiMonthly : t.subscriptions.freqMonthly

  if (loading) return <PageSpinner />

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <p className="hint" style={{ margin: 0, flex: 1 }}>{t.subscriptions.hint}</p>
        <button className="btn" onClick={openCreate}>{t.subscriptions.add}</button>
      </div>

      {items.length === 0 ? (
        <div className="empty">{t.subscriptions.empty}</div>
      ) : (
        <div className="list">
          {items.map((s) => (
            <div className="list-item tinted" key={s.id} style={tintVars(s.categoryColor || '#0f5c4d')}>
              <span className="badge-icon">{iconFor(s.categoryIcon) || <Repeat size={20} />}</span>
              <div className="meta">
                <div className="title">
                  {s.name}
                  {!s.active && <span className="pill pill-manual" style={{ marginLeft: 8 }}>{t.subscriptions.paused}</span>}
                </div>
                <div className="sub">
                  {categoryLabel(s.categoryName)}
                  {' · '}
                  {freqLabel(s.payFrequency)}
                  {' · '}
                  {t.subscriptions.dayOfMonth.replace('{day}', s.dayOfMonth)}
                  {s.payFrequency === 'SemiMonthly' && s.secondDayOfMonth
                    ? ` & ${s.secondDayOfMonth}` : ''}
                  {' · '}
                  <span className="pm-inline">
                    {pmTypeIcon(s.paymentMethodType, { size: 13 })}
                    {accountLabel(s.paymentMethodName)}
                  </span>
                  {' · '}
                  {t.subscriptions.next}: {formatDate(s.nextChargeDate)}
                </div>
              </div>
              <div className="list-item-end">
                <span className="amount neg">−{formatMoney(s.amount, s.currency)}</span>
                <button className="btn secondary" onClick={() => openEdit(s)}>{t.common.edit}</button>
                <button
                  className="btn danger"
                  onClick={() => setConfirm({ message: t.subscriptions.deleteConfirm, run: () => remove(s.id) })}
                >
                  {t.common.delete}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? t.subscriptions.editTitle : t.subscriptions.addTitle}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={submit}>
            <div className="field">
              <label>{t.common.name}</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Netflix"
                autoFocus
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t.common.amount}</label>
                <input
                  type="number" step="0.01" min="0.01" required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t.common.currency}</label>
                <div className="static-field">{activeCurrency}</div>
              </div>
            </div>
            <div className="field">
              <label>{t.common.category}</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="" disabled>{t.common.select}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{categoryLabel(c.name)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t.common.paymentMethod}</label>
              <select
                required
                value={form.paymentMethodId}
                onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value })}
              >
                <option value="" disabled>{t.common.select}</option>
                <AccountOptionGroups
                  methods={paymentMethods.filter((p) => !p.archived)}
                  accountLabel={accountLabel}
                  formatOption={pmLabel}
                  labels={{ Debit: t.cards.sectionDebit, CreditCard: t.cards.sectionCreditCard, Cash: t.cards.sectionCash }}
                />
              </select>
            </div>
            <div className="field">
              <label>{t.subscriptions.frequency}</label>
              <select
                value={form.payFrequency}
                onChange={(e) => setForm({ ...form, payFrequency: e.target.value })}
              >
                <option value="Monthly">{t.subscriptions.freqMonthly}</option>
                <option value="SemiMonthly">{t.subscriptions.freqSemiMonthly}</option>
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label>{t.subscriptions.chargeDay}</label>
                <input
                  type="number" min="1" max="31" required
                  value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                />
              </div>
              {form.payFrequency === 'SemiMonthly' && (
                <div className="field">
                  <label>{t.subscriptions.secondChargeDay}</label>
                  <input
                    type="number" min="1" max="31" required
                    value={form.secondDayOfMonth}
                    onChange={(e) => setForm({ ...form, secondDayOfMonth: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input
                id="sub-autopost"
                type="checkbox"
                checked={form.autoPost}
                onChange={(e) => setForm({ ...form, autoPost: e.target.checked })}
              />
              <label htmlFor="sub-autopost" style={{ margin: 0 }}>{t.subscriptions.autoPost}</label>
            </div>
            {editingId && (
              <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <input
                  id="sub-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <label htmlFor="sub-active" style={{ margin: 0 }}>{t.subscriptions.active}</label>
              </div>
            )}
            {error && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{error}</div>}
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirm}
        message={confirm?.message}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => { await confirm.run(); setConfirm(null) }}
      />
    </div>
  )
}
