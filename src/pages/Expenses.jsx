import { useEffect, useMemo, useState } from 'react'
import { ExpensesApi, CategoriesApi, BalanceApi, assetUrl } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import ReceiptInput from '../components/ReceiptInput'
import { formatMoney, formatDate } from '../utils/format'
import { iconFor } from '../utils/icons'
import { useI18n } from '../i18n/I18nContext'

const now = new Date()

export default function Expenses() {
  const { t } = useI18n()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ amount: '', description: '', categoryId: '', date: '', receipt: null })

  const load = async () => {
    setLoading(true)
    const [cats, sum, exp] = await Promise.all([
      CategoriesApi.list(),
      BalanceApi.monthly({ year, month }),
      ExpensesApi.list({ year, month }),
    ])
    setCategories(cats)
    setSummary(sum)
    setExpenses(exp)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  const openCreate = () => {
    setForm({
      amount: '',
      description: '',
      categoryId: categories[0]?.id ?? '',
      date: new Date().toISOString().slice(0, 10),
      receipt: null,
    })
    setShowModal(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0 || !form.categoryId) return
    setSaving(true)
    try {
      await ExpensesApi.create({
        amount,
        description: form.description,
        categoryId: Number(form.categoryId),
        date: form.date ? new Date(form.date).toISOString() : undefined,
        receipt: form.receipt,
      })
      setShowModal(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    await ExpensesApi.remove(id)
    await load()
  }

  const years = useMemo(() => {
    const y = now.getFullYear()
    return [y - 2, y - 1, y, y + 1]
  }, [])

  if (loading || !summary) return <div className="loading">{t.common.loading}</div>

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
        <StatCard label={t.expenses.incomeThisMonth} value={summary.income} icon="📈" color="#10b981" />
        <StatCard label={t.expenses.spentThisMonth} value={summary.expense} icon="💸" color="#ef4444" />
        <StatCard
          label={t.expenses.remainingThisMonth}
          value={summary.net}
          icon="🧮"
          color="#6366f1"
          tone={summary.net >= 0 ? 'pos' : 'neg'}
        />
      </div>

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
                    <div style={{ fontWeight: 600 }}>{c.categoryName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{formatMoney(c.spent)}</div>
                    {c.monthlyBudget != null && (
                      <div className="hint" style={{ fontSize: 12, color: over ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {t.expenses.of} {formatMoney(c.monthlyBudget)}
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
      {expenses.length === 0 ? (
        <div className="empty">{t.expenses.noExpenses}</div>
      ) : (
        <div className="list">
          {expenses.map((e) => (
            <div className="list-item" key={e.id}>
              <span className="badge-icon" style={{ background: `${e.categoryColor}22`, color: e.categoryColor }}>
                {iconFor(e.categoryIcon)}
              </span>
              <div className="meta">
                <div className="title">{e.description || e.categoryName}</div>
                <div className="sub">{e.categoryName} · {formatDate(e.date)}</div>
              </div>
              {e.receiptUrl && (
                <a href={assetUrl(e.receiptUrl)} target="_blank" rel="noreferrer" title={t.common.viewReceipt}>
                  <img className="receipt-thumb" src={assetUrl(e.receiptUrl)} alt="receipt" />
                </a>
              )}
              <span className="amount neg">−{formatMoney(e.amount)}</span>
              <button className="btn danger" onClick={() => remove(e.id)}>{t.common.delete}</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={t.dashboard.expenseModalTitle} onClose={() => setShowModal(false)}>
          <form onSubmit={submit}>
            <div className="field">
              <label>{t.common.amount}</label>
              <input
                type="number" step="0.01" min="0" autoFocus required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label>{t.common.category}</label>
              <select
                required
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="" disabled>{t.common.select}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <ReceiptInput
                file={form.receipt}
                onChange={(f) => setForm({ ...form, receipt: f })}
              />
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
