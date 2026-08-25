import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BalanceApi, IncomesApi, ExpensesApi, CategoriesApi, assetUrl } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import ReceiptInput from '../components/ReceiptInput'
import { formatMoney, formatDate } from '../utils/format'
import { iconFor } from '../utils/icons'
import { useI18n } from '../i18n/I18nContext'

const todayIso = () => new Date().toISOString().slice(0, 10)
const now = new Date()

export default function Dashboard() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [balance, setBalance] = useState(null)
  const [incomes, setIncomes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [monthly, setMonthly] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'income' | 'expense' | null
  const [saving, setSaving] = useState(false)
  const [incomeForm, setIncomeForm] = useState({ amount: '', description: '', date: '' })
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', categoryId: '', date: '', receipt: null })

  const load = async () => {
    setLoading(true)
    const [b, inc, exp, cats, mon] = await Promise.all([
      BalanceApi.get(),
      IncomesApi.list(),
      ExpensesApi.list(),
      CategoriesApi.list(),
      BalanceApi.monthly({ year: now.getFullYear(), month: now.getMonth() + 1 }),
    ])
    setBalance(b)
    setIncomes(inc)
    setExpenses(exp)
    setCategories(cats)
    setMonthly(mon)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openIncome = () => {
    setIncomeForm({ amount: '', description: '', date: todayIso() })
    setModal('income')
  }

  const openExpense = () => {
    setExpenseForm({ amount: '', description: '', categoryId: categories[0]?.id ?? '', date: todayIso(), receipt: null })
    setModal('expense')
  }

  const goCreateCategory = () => {
    setModal(null)
    navigate('/categories', { state: { openCreate: true } })
  }

  const addIncome = async (e) => {
    e.preventDefault()
    const amount = parseFloat(incomeForm.amount)
    if (!amount || amount <= 0) return
    setSaving(true)
    try {
      await IncomesApi.create({
        amount,
        description: incomeForm.description,
        date: incomeForm.date ? new Date(incomeForm.date).toISOString() : undefined,
      })
      setModal(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const addExpense = async (e) => {
    e.preventDefault()
    const amount = parseFloat(expenseForm.amount)
    if (!amount || amount <= 0 || !expenseForm.categoryId) return
    setSaving(true)
    try {
      await ExpensesApi.create({
        amount,
        description: expenseForm.description,
        categoryId: Number(expenseForm.categoryId),
        date: expenseForm.date ? new Date(expenseForm.date).toISOString() : undefined,
        receipt: expenseForm.receipt,
      })
      setModal(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const deleteIncome = async (id) => {
    await IncomesApi.remove(id)
    await load()
  }

  const deleteExpense = async (id) => {
    await ExpensesApi.remove(id)
    await load()
  }

  if (loading) return <div className="loading">{t.common.loading}</div>

  const movements = [
    ...incomes.map((i) => ({ ...i, type: 'income' })),
    ...expenses.map((e) => ({ ...e, type: 'expense' })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)

  const spentByCategory = new Map((monthly?.byCategory ?? []).map((c) => [c.categoryId, c.spent]))
  const budgets = categories
    .filter((c) => c.monthlyBudget != null && c.monthlyBudget > 0)
    .map((c) => {
      const spent = spentByCategory.get(c.id) ?? 0
      const budget = c.monthlyBudget
      const over = spent > budget
      return {
        ...c,
        spent,
        budget,
        over,
        remaining: budget - spent,
        pct: Math.min(100, (spent / budget) * 100),
      }
    })
    .sort((a, b) => b.pct - a.pct)

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.dashboard.title}</h1>
          <p>{t.dashboard.subtitle}</p>
        </div>
        <div className="toolbar">
          <button className="btn secondary" onClick={openExpense}>{t.dashboard.addExpense}</button>
          <button className="btn" onClick={openIncome}>{t.dashboard.addIncome}</button>
        </div>
      </div>

      <div className="grid grid-3">
        <StatCard
          label={t.dashboard.availableBalance}
          value={balance.balance}
          icon="💰"
          color="#6366f1"
          tone={balance.balance >= 0 ? 'pos' : 'neg'}
          hint={t.dashboard.balanceHint}
        />
        <StatCard label={t.dashboard.totalIncome} value={balance.totalIncome} icon="📈" color="#10b981" />
        <StatCard label={t.dashboard.totalExpenses} value={balance.totalExpense} icon="📉" color="#ef4444" />
      </div>

      <h2 className="section-title">
        {t.dashboard.monthlyBudgets}
        <span className="info-hint">
          <span className="dot" tabIndex={0}>i</span>
          <span className="bubble">{t.dashboard.budgetsHint}</span>
        </span>
      </h2>
      {budgets.length === 0 ? (
        <div className="empty">{t.dashboard.noBudgets}</div>
      ) : (
        <div className="grid grid-2">
          {budgets.map((c) => (
            <div className="card budget-card" key={c.id}>
              <div className="row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge-icon" style={{ background: `${c.color}22`, color: c.color }}>
                    {iconFor(c.icon)}
                  </span>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="b-amount">{formatMoney(c.spent)}</div>
                  <div className="hint" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {t.dashboard.spentOf} {formatMoney(c.budget)}
                  </div>
                </div>
              </div>
              <div className="progress">
                <span style={{ width: `${c.pct}%`, background: c.over ? 'var(--danger)' : 'var(--success)' }} />
              </div>
              <div className={`b-sub ${c.over ? 'neg' : 'pos'}`}>
                {c.over
                  ? `${t.dashboard.overBudget} ${formatMoney(c.spent - c.budget)}`
                  : `${formatMoney(c.remaining)} ${t.dashboard.remaining}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">{t.dashboard.recentActivity}</h2>
      {movements.length === 0 ? (
        <div className="empty">{t.dashboard.emptyMovements}</div>
      ) : (
        <div className="list">
          {movements.map((m) => (
            <div className="list-item" key={`${m.type}-${m.id}`}>
              <span className="badge-icon" style={{
                background: m.type === 'income' ? '#10b98122' : `${m.categoryColor}22`,
                color: m.type === 'income' ? '#10b981' : m.categoryColor,
              }}>
                {m.type === 'income' ? '⬆️' : iconFor(m.categoryIcon)}
              </span>
              <div className="meta">
                <div className="title">
                  {m.type === 'income' ? (m.description || t.common.income) : (m.description || m.categoryName)}
                </div>
                <div className="sub">
                  {m.type === 'expense' ? `${m.categoryName} · ` : ''}{formatDate(m.date)}
                </div>
              </div>
              {m.type === 'expense' && m.receiptUrl && (
                <a href={assetUrl(m.receiptUrl)} target="_blank" rel="noreferrer" title={t.common.viewReceipt}>
                  <img className="receipt-thumb" src={assetUrl(m.receiptUrl)} alt="receipt" />
                </a>
              )}
              <span className={`amount ${m.type === 'income' ? 'pos' : 'neg'}`}>
                {m.type === 'income' ? '+' : '−'}{formatMoney(m.amount)}
              </span>
              <button
                className="btn danger"
                onClick={() => (m.type === 'income' ? deleteIncome(m.id) : deleteExpense(m.id))}
              >
                {t.common.delete}
              </button>
            </div>
          ))}
        </div>
      )}

      {modal === 'income' && (
        <Modal title={t.dashboard.incomeModalTitle} onClose={() => setModal(null)}>
          <form onSubmit={addIncome}>
            <div className="field">
              <label>{t.common.amount}</label>
              <input
                type="number" step="0.01" min="0" autoFocus required
                value={incomeForm.amount}
                onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label>{t.common.description}</label>
              <input
                type="text"
                value={incomeForm.description}
                onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                placeholder={t.dashboard.incomePlaceholder}
              />
            </div>
            <div className="field">
              <label>{t.common.date}</label>
              <input
                type="date"
                value={incomeForm.date}
                onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
              />
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setModal(null)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'expense' && (
        <Modal title={t.dashboard.expenseModalTitle} onClose={() => setModal(null)}>
          <form onSubmit={addExpense}>
            <div className="field">
              <label>{t.common.amount}</label>
              <input
                type="number" step="0.01" min="0" autoFocus required
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label>{t.common.category}</label>
              <select
                required
                value={expenseForm.categoryId}
                onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
              >
                <option value="" disabled>{t.common.select}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <label>{t.common.description}</label>
              <input
                type="text"
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder={t.common.optional}
              />
            </div>
            <div className="field">
              <label>{t.common.date}</label>
              <input
                type="date"
                value={expenseForm.date}
                onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{t.common.receipt}</label>
              <ReceiptInput
                file={expenseForm.receipt}
                onChange={(f) => setExpenseForm({ ...expenseForm, receipt: f })}
              />
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setModal(null)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
