import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExpensesApi, CategoriesApi, BalanceApi, ExchangesApi, PaymentMethodsApi, assetUrl } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import ReceiptInput from '../components/ReceiptInput'
import { formatMoney, formatDate } from '../utils/format'
import { iconFor } from '../utils/icons'
import { CURRENCIES } from '../utils/currencies'
import { tintVars } from '../utils/color'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const now = new Date()

export default function Expenses() {
  const { t, categoryLabel } = useI18n()
  const { currency: activeCurrency } = useCurrency()
  const navigate = useNavigate()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [exchanges, setExchanges] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [listError, setListError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState({
    amount: '', description: '', categoryId: '', date: '', currency: '',
    paymentMethodId: '', receipt: null, existingReceiptUrl: null, removeReceipt: false,
  })

  const load = async () => {
    setLoading(true)
    const [cats, sum, exp, exch, pms] = await Promise.all([
      CategoriesApi.list(),
      BalanceApi.monthly({ year, month, currency: activeCurrency }),
      ExpensesApi.list({ year, month, currency: activeCurrency }),
      ExchangesApi.list().catch(() => []),
      PaymentMethodsApi.list().catch(() => []),
    ])
    setCategories(cats)
    setSummary(sum)
    setExpenses(exp)
    setExchanges(exch)
    setPaymentMethods(pms)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, activeCurrency])

  const openCreate = () => {
    setEditingId(null)
    setError('')
    setForm({
      amount: '',
      description: '',
      categoryId: categories[0]?.id ?? '',
      date: new Date().toISOString().slice(0, 10),
      currency: activeCurrency,
      paymentMethodId: defaultPmId(),
      receipt: null,
      existingReceiptUrl: null,
      removeReceipt: false,
    })
    setShowModal(true)
  }

  const openEdit = (e) => {
    setEditingId(e.id)
    setError('')
    setForm({
      amount: String(e.amount ?? ''),
      description: e.description || '',
      categoryId: e.categoryId ?? '',
      date: e.date ? new Date(e.date).toISOString().slice(0, 10) : '',
      currency: e.currency || activeCurrency,
      paymentMethodId: e.paymentMethodId ?? defaultPmId(),
      receipt: null,
      existingReceiptUrl: e.receiptUrl || null,
      removeReceipt: false,
    })
    setShowModal(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0 || !form.categoryId || !form.paymentMethodId) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        amount,
        description: form.description,
        categoryId: Number(form.categoryId),
        date: form.date ? new Date(form.date).toISOString() : undefined,
        receipt: form.receipt,
        currency: form.currency || activeCurrency,
        paymentMethodId: form.paymentMethodId ? Number(form.paymentMethodId) : undefined,
      }
      if (editingId) {
        await ExpensesApi.update(editingId, { ...payload, removeReceipt: form.removeReceipt && !form.receipt })
      } else {
        await ExpensesApi.create(payload)
      }
      setShowModal(false)
      await load()
    } catch (err) {
      setError(err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    setListError('')
    try {
      await ExpensesApi.remove(id)
      await load()
    } catch (err) {
      setListError(err?.response?.data?.message || t.expenses.deleteError)
    }
  }

  const removeExchange = async (id) => {
    setListError('')
    try {
      await ExchangesApi.remove(id)
      await load()
    } catch (err) {
      setListError(err?.response?.data?.message || t.expenses.deleteError)
    }
  }

  const goCreateCategory = () => {
    setShowModal(false)
    navigate('/categories', { state: { openCreate: true } })
  }

  const pmLabel = (p) => {
    const type = p.type === 'CreditCard' ? t.cards.typeCreditCard
      : p.type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit
    return `${p.name} · ${type} · ${p.currency}`
  }

  const defaultPmId = () => {
    const active = paymentMethods.filter((p) => !p.archived)
    return String(
      active.find((p) => p.isFavorite)?.id
      ?? active.find((p) => p.currency === activeCurrency)?.id
      ?? active[0]?.id ?? '',
    )
  }

  const years = useMemo(() => {
    const y = now.getFullYear()
    return [y - 2, y - 1, y, y + 1]
  }, [])

  if (loading || !summary) return <div className="loading">{t.common.loading}</div>

  // Exchanges touching the active currency this month. They are transfers (not expenses), so they
  // are shown in the activity list but never counted as spending or income.
  const monthExchanges = exchanges.filter((x) => {
    const d = new Date(x.date)
    const inMonth = d.getFullYear() === year && d.getMonth() + 1 === month
    return inMonth && (x.fromCurrency === activeCurrency || x.toCurrency === activeCurrency)
  })
  const transfersOut = monthExchanges
    .filter((x) => x.fromCurrency === activeCurrency)
    .reduce((s, x) => s + x.fromAmount, 0)
  const transfersIn = monthExchanges
    .filter((x) => x.toCurrency === activeCurrency)
    .reduce((s, x) => s + x.toAmount, 0)
  const transfersNet = transfersIn - transfersOut

  // Merge expenses + exchange legs into a single, date-sorted activity list.
  const details = [
    ...expenses.map((e) => ({ ...e, kind: 'expense' })),
    ...monthExchanges.map((x) => {
      const out = x.fromCurrency === activeCurrency
      return {
        kind: 'exchange',
        id: x.id,
        date: x.date,
        out,
        amount: out ? x.fromAmount : x.toAmount,
        otherCurrency: out ? x.toCurrency : x.fromCurrency,
        otherAmount: out ? x.toAmount : x.fromAmount,
      }
    }),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.expenses.title}</h1>
          <p>{t.expenses.subtitle}</p>
        </div>
        <div className="toolbar">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {t.months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn" onClick={openCreate}>{t.dashboard.addExpense}</button>
        </div>
      </div>

      <div className="grid grid-3">
        <StatCard label={t.expenses.incomeThisMonth} value={summary.income} currency={activeCurrency} icon="📈" color="#10b981" />
        <StatCard label={t.expenses.spentThisMonth} value={summary.expense} currency={activeCurrency} icon="💸" color="#ef4444" />
        <StatCard
          label={t.expenses.remainingThisMonth}
          value={summary.net}
          currency={activeCurrency}
          icon="🧮"
          color="#0f5c4d"
          tone={summary.net >= 0 ? 'pos' : 'neg'}
          hint={t.expenses.remainingHint}
        />
      </div>

      {transfersNet !== 0 && (
        <div className="insight" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>🔄</span>
          <span>{t.expenses.transfersThisMonth}:</span>
          <strong className={transfersNet < 0 ? 'neg' : 'pos'}>
            {transfersNet < 0 ? '−' : '+'}{formatMoney(Math.abs(transfersNet), activeCurrency)}
          </strong>
          <span className="hint" style={{ color: 'var(--text-muted)' }}>· {t.expenses.transfersHint}</span>
        </div>
      )}

      <h2 className="section-title">{t.expenses.spendingByCategory}</h2>
      {summary.byCategory.length === 0 ? (
        <div className="empty">{t.expenses.noExpensesMonth} {t.months[month - 1]} {year}.</div>
      ) : (
        <div className="grid grid-2">
          {summary.byCategory.map((c) => {
            const pct = c.monthlyBudget ? Math.min(100, (c.spent / c.monthlyBudget) * 100) : null
            const over = c.monthlyBudget && c.spent > c.monthlyBudget
            return (
              <div className="card" key={c.categoryId}>
                <div className="row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="badge-icon" style={{ background: `${c.categoryColor}22`, color: c.categoryColor }}>
                      {iconFor(c.categoryIcon)}
                    </span>
                    <div style={{ fontWeight: 600 }}>{categoryLabel(c.categoryName)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{formatMoney(c.spent, activeCurrency)}</div>
                    {c.monthlyBudget != null && (
                      <div className="hint" style={{ fontSize: 12, color: over ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {t.expenses.of} {formatMoney(c.monthlyBudget, activeCurrency)}
                      </div>
                    )}
                  </div>
                </div>
                {pct != null && (
                  <div className="progress">
                    <span style={{ width: `${pct}%`, background: over ? 'var(--danger)' : c.categoryColor }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <h2 className="section-title">{t.expenses.expenseDetails}</h2>
      {listError && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{listError}</div>}
      {details.length === 0 ? (
        <div className="empty">{t.expenses.noExpenses}</div>
      ) : (
        <div className="list">
          {details.map((e) => {
            if (e.kind === 'exchange') {
              const incoming = !e.out
              return (
                <div className="list-item tinted" key={`exchange-${e.id}`} style={tintVars('#b8943e')}>
                  <span className="badge-icon">🔄</span>
                  <div className="meta">
                    <div className="title">{t.dashboard.exchange}</div>
                    <div className="sub">
                      {incoming
                        ? `${t.dashboard.fromLabel} ${formatMoney(e.otherAmount, e.otherCurrency)}`
                        : `${t.dashboard.toLabel} ${formatMoney(e.otherAmount, e.otherCurrency)}`}
                      {' · '}{formatDate(e.date)}
                    </div>
                  </div>
                  <span className={`amount ${incoming ? 'pos' : 'neg'}`}>
                    {incoming ? '+' : '−'}{formatMoney(e.amount, activeCurrency)}
                  </span>
                  <button
                    className="btn danger"
                    onClick={() => setConfirm({ message: t.common.confirmDelete, run: () => removeExchange(e.id) })}
                  >
                    {t.common.delete}
                  </button>
                </div>
              )
            }
            return (
              <div
                className="list-item tinted"
                key={e.id}
                style={tintVars(paymentMethods.find((p) => p.id === e.paymentMethodId)?.color || e.categoryColor)}
              >
                <span className="badge-icon">
                  {iconFor(e.categoryIcon)}
                </span>
                <div className="meta">
                  <div className="title">{e.description || categoryLabel(e.categoryName)}</div>
                  <div className="sub">
                    {categoryLabel(e.categoryName)} · {formatDate(e.date)}
                    {e.paymentMethodName ? ` · 💳 ${e.paymentMethodName}` : ''}
                  </div>
                </div>
                {e.receiptUrl && (
                  <a href={assetUrl(e.receiptUrl)} target="_blank" rel="noreferrer" title={t.common.viewReceipt}>
                    <img className="receipt-thumb" src={assetUrl(e.receiptUrl)} alt="receipt" />
                  </a>
                )}
                <span className="amount neg">−{formatMoney(e.amount, e.currency || activeCurrency)}</span>
                {e.creditId ? (
                  <button
                    className="btn secondary"
                    title={t.expenses.creditLinkedHint}
                    onClick={() => navigate(`/credits/${e.creditId}`)}
                  >
                    {t.expenses.manageInCredits}
                  </button>
                ) : (
                  <>
                    <button className="btn secondary" onClick={() => openEdit(e)}>{t.common.edit}</button>
                    <button
                      className="btn danger"
                      onClick={() => setConfirm({ message: t.common.confirmDelete, run: () => remove(e.id) })}
                    >
                      {t.common.delete}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? t.dashboard.editExpenseTitle : t.dashboard.expenseModalTitle}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={submit}>
            <div className="field-row">
              <div className="field" style={{ flex: 2 }}>
                <label>{t.common.amount}</label>
                <input
                  type="number" step="0.01" min="0" autoFocus required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.common.currency}</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>{t.common.category}</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    goCreateCategory()
                    return
                  }
                  setForm({ ...form, categoryId: e.target.value })
                }}
              >
                <option value="" disabled>{t.common.select}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c.name)}</option>)}
                <option value="__new__">{t.common.addNewCategory}</option>
              </select>
              {categories.length === 0 && (
                <div className="field-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                  {t.dashboard.noCategories}{' '}
                  <button type="button" className="link-btn" onClick={goCreateCategory}>
                    {t.dashboard.createCategoryLink}
                  </button>
                </div>
              )}
            </div>
            <div className="field">
              <label>{t.common.paymentMethod}</label>
              <select
                required
                value={form.paymentMethodId}
                onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value })}
              >
                <option value="" disabled>{t.common.select}</option>
                {paymentMethods.filter((p) => !p.archived).map((p) => (
                  <option key={p.id} value={p.id}>{pmLabel(p)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t.common.description}</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t.expenses.compraPlaceholder}
              />
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
              <label>{t.common.receipt}</label>
              {form.existingReceiptUrl && !form.removeReceipt && !form.receipt ? (
                <div className="receipt-preview">
                  <img src={assetUrl(form.existingReceiptUrl)} alt="receipt" />
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => setForm({ ...form, removeReceipt: true })}
                  >
                    {t.common.remove}
                  </button>
                  <div className="field-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                    {t.common.keepReceiptHint}
                  </div>
                </div>
              ) : (
                <ReceiptInput
                  file={form.receipt}
                  onChange={(f) => setForm({ ...form, receipt: f, removeReceipt: false })}
                />
              )}
            </div>
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
        onConfirm={async () => {
          await confirm.run()
          setConfirm(null)
        }}
      />
    </div>
  )
}
