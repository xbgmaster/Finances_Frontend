import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BalanceApi, IncomesApi, ExpensesApi, CategoriesApi, CreditsApi, ExchangesApi, PaymentMethodsApi, assetUrl } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import ReceiptInput from '../components/ReceiptInput'
import { formatMoney, formatDate } from '../utils/format'
import { iconFor } from '../utils/icons'
import { CURRENCIES } from '../utils/currencies'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const todayIso = () => new Date().toISOString().slice(0, 10)
const now = new Date()

export default function Dashboard() {
  const { t } = useI18n()
  const { currency: activeCurrency } = useCurrency()
  const navigate = useNavigate()
  const [balance, setBalance] = useState(null)
  const [incomes, setIncomes] = useState([])
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [monthly, setMonthly] = useState(null)
  const [creditAlerts, setCreditAlerts] = useState(null)
  const [exchanges, setExchanges] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'income' | 'expense' | 'exchange' | null
  const [saving, setSaving] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState(null)
  const [expenseError, setExpenseError] = useState('')
  const [movementError, setMovementError] = useState('')
  const [confirm, setConfirm] = useState(null)
  // Recent activity: text/date search + pagination.
  const [actSearch, setActSearch] = useState('')
  const [actDate, setActDate] = useState('')
  const [actPageSize, setActPageSize] = useState(5)
  const [actPage, setActPage] = useState(1)
  const [incomeForm, setIncomeForm] = useState({ amount: '', description: '', date: '', currency: '', paymentMethodId: '' })
  const [expenseForm, setExpenseForm] = useState({
    amount: '', description: '', categoryId: '', date: '', currency: '',
    paymentMethodId: '', receipt: null, existingReceiptUrl: null, removeReceipt: false,
  })
  const [exchangeForm, setExchangeForm] = useState({ fromCurrency: '', fromAmount: '', toCurrency: '', rate: '', date: '', note: '' })

  const load = async () => {
    setLoading(true)
    const [b, inc, exp, cats, mon, alerts, exch, pms] = await Promise.all([
      BalanceApi.get(),
      IncomesApi.list(),
      ExpensesApi.list(),
      CategoriesApi.list(),
      BalanceApi.monthly({ year: now.getFullYear(), month: now.getMonth() + 1, currency: activeCurrency }),
      CreditsApi.alerts().catch(() => null),
      ExchangesApi.list().catch(() => []),
      PaymentMethodsApi.list().catch(() => []),
    ])
    setBalance(b)
    setIncomes(inc)
    setExpenses(exp)
    setCategories(cats)
    setMonthly(mon)
    setCreditAlerts(alerts)
    setExchanges(exch)
    setPaymentMethods(pms)
    setLoading(false)
  }

  // Reload the currency-scoped monthly summary whenever the lens changes.
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCurrency])

  // Reset to the first page whenever the search/filters change.
  useEffect(() => {
    setActPage(1)
  }, [actSearch, actDate, actPageSize, activeCurrency])

  const openIncome = () => {
    setIncomeForm({ amount: '', description: '', date: todayIso(), currency: activeCurrency, paymentMethodId: '' })
    setModal('income')
  }

  const openExpense = () => {
    setEditingExpenseId(null)
    setExpenseError('')
    setExpenseForm({
      amount: '', description: '', categoryId: categories[0]?.id ?? '', date: todayIso(),
      currency: activeCurrency, paymentMethodId: defaultPmId(), receipt: null, existingReceiptUrl: null, removeReceipt: false,
    })
    setModal('expense')
  }

  const openEditExpense = (m) => {
    setEditingExpenseId(m.id)
    setExpenseError('')
    setExpenseForm({
      amount: String(m.amount ?? ''),
      description: m.description || '',
      categoryId: m.categoryId ?? '',
      date: m.date ? new Date(m.date).toISOString().slice(0, 10) : '',
      currency: m.currency || activeCurrency,
      paymentMethodId: m.paymentMethodId ?? defaultPmId(),
      receipt: null,
      existingReceiptUrl: m.receiptUrl || null,
      removeReceipt: false,
    })
    setModal('expense')
  }

  const goCreateCategory = () => {
    setModal(null)
    navigate('/categories', { state: { openCreate: true } })
  }

  // Label a payment method with its type so debit/credit/cash are distinguishable.
  const pmLabel = (p) => {
    const type = p.type === 'CreditCard' ? t.cards.typeCreditCard
      : p.type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit
    return `${p.name} · ${type} · ${p.currency}`
  }

  // Preselect a method: favorite first, then one in the active currency, else the first.
  const defaultPmId = () => {
    const active = paymentMethods.filter((p) => !p.archived)
    return String(
      active.find((p) => p.isFavorite)?.id
      ?? active.find((p) => p.currency === activeCurrency)?.id
      ?? active[0]?.id ?? '',
    )
  }

  const openExchange = () => {
    const from = activeCurrency
    const to = CURRENCIES.find((c) => c !== from) || from
    setExchangeForm({ fromCurrency: from, fromAmount: '', toCurrency: to, rate: '', date: todayIso(), note: '' })
    setModal('exchange')
  }

  // Destination amount is derived: what you send × the rate (value of 1 source unit).
  const exchangeReceive = () => {
    const from = parseFloat(exchangeForm.fromAmount)
    const rate = parseFloat(exchangeForm.rate)
    return from > 0 && rate > 0 ? Math.round(from * rate * 100) / 100 : 0
  }

  const addExchange = async (e) => {
    e.preventDefault()
    const fromAmount = parseFloat(exchangeForm.fromAmount)
    const rate = parseFloat(exchangeForm.rate)
    const toAmount = exchangeReceive()
    if (!fromAmount || fromAmount <= 0 || !rate || rate <= 0 || toAmount <= 0) return
    if (exchangeForm.fromCurrency === exchangeForm.toCurrency) return
    setSaving(true)
    try {
      await ExchangesApi.create({
        fromCurrency: exchangeForm.fromCurrency,
        fromAmount,
        toCurrency: exchangeForm.toCurrency,
        toAmount,
        date: exchangeForm.date ? new Date(exchangeForm.date).toISOString() : undefined,
        note: exchangeForm.note.trim() || undefined,
      })
      setModal(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const deleteExchange = async (id) => {
    await ExchangesApi.remove(id)
    await load()
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
        currency: incomeForm.currency || undefined,
        paymentMethodId: incomeForm.paymentMethodId ? Number(incomeForm.paymentMethodId) : undefined,
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
    if (!amount || amount <= 0 || !expenseForm.categoryId || !expenseForm.paymentMethodId) return
    setSaving(true)
    setExpenseError('')
    try {
      const payload = {
        amount,
        description: expenseForm.description,
        categoryId: Number(expenseForm.categoryId),
        date: expenseForm.date ? new Date(expenseForm.date).toISOString() : undefined,
        receipt: expenseForm.receipt,
        currency: expenseForm.currency || undefined,
        paymentMethodId: expenseForm.paymentMethodId ? Number(expenseForm.paymentMethodId) : undefined,
      }
      if (editingExpenseId) {
        await ExpensesApi.update(editingExpenseId, {
          ...payload,
          removeReceipt: expenseForm.removeReceipt && !expenseForm.receipt,
        })
      } else {
        await ExpensesApi.create(payload)
      }
      setModal(null)
      await load()
    } catch (err) {
      setExpenseError(err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSaving(false)
    }
  }

  const deleteIncome = async (id) => {
    setMovementError('')
    try {
      await IncomesApi.remove(id)
      await load()
    } catch (err) {
      setMovementError(err?.response?.data?.message || t.expenses.deleteError)
    }
  }

  const deleteExpense = async (id) => {
    setMovementError('')
    try {
      await ExpensesApi.remove(id)
      await load()
    } catch (err) {
      setMovementError(err?.response?.data?.message || t.expenses.deleteError)
    }
  }

  if (loading) return <div className="loading">{t.common.loading}</div>

  const baseCurrency = balance.baseCurrency
  const selCur = activeCurrency
  const isBase = selCur === baseCurrency

  const selEntry = (balance.byCurrency ?? []).find((c) => c.currency === selCur)
    ?? { balance: 0, totalIncome: 0, totalExpense: 0 }

  // Movements are strictly per-currency (no conversion). Exchanges show the leg that affects
  // the selected currency: money leaving it (out) or arriving into it (in).
  const movements = [
    ...incomes
      .filter((i) => (i.currency || baseCurrency) === selCur)
      .map((i) => ({ ...i, kind: 'income' })),
    ...expenses
      .filter((e) => (e.currency || baseCurrency) === selCur)
      .map((e) => ({ ...e, kind: 'expense' })),
    ...exchanges
      .filter((x) => x.fromCurrency === selCur || x.toCurrency === selCur)
      .map((x) => {
        const out = x.fromCurrency === selCur
        return {
          id: x.id,
          kind: 'exchange',
          dir: out ? 'out' : 'in',
          date: x.date,
          amount: out ? x.fromAmount : x.toAmount,
          currency: selCur,
          otherCurrency: out ? x.toCurrency : x.fromCurrency,
          otherAmount: out ? x.toAmount : x.fromAmount,
        }
      }),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  // Text/date search over the current-currency movements.
  const actQuery = actSearch.trim().toLowerCase()
  const filteredMovements = movements.filter((m) => {
    if (actDate) {
      const d = m.date ? new Date(m.date).toISOString().slice(0, 10) : ''
      if (d !== actDate) return false
    }
    if (actQuery) {
      const label = m.kind === 'income' ? t.common.income
        : m.kind === 'exchange' ? t.dashboard.exchange
        : (m.categoryName || t.common.expense)
      const haystack = [
        m.description,
        label,
        m.categoryName,
        m.paymentMethodName,
        m.otherCurrency,
        m.date ? formatDate(m.date) : '',
      ].filter(Boolean).join(' ').toLowerCase()
      if (!haystack.includes(actQuery)) return false
    }
    return true
  })

  const actTotal = filteredMovements.length
  const actTotalPages = Math.max(1, Math.ceil(actTotal / actPageSize))
  const actCurrentPage = Math.min(actPage, actTotalPages)
  const pagedMovements = filteredMovements.slice(
    (actCurrentPage - 1) * actPageSize,
    actCurrentPage * actPageSize,
  )

  const spentByCategory = new Map((monthly?.byCategory ?? []).map((c) => [c.categoryId, c.spent]))
  const budgetFor = (c) => c.budgets?.[selCur] ?? null
  const budgets = categories
    .filter((c) => budgetFor(c) != null && budgetFor(c) > 0)
    .map((c) => {
      const spent = spentByCategory.get(c.id) ?? 0
      const budget = budgetFor(c)
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
          <button className="btn secondary" onClick={openExchange}>{t.dashboard.exchange}</button>
          <button className="btn secondary" onClick={openExpense}>{t.dashboard.addExpense}</button>
          <button className="btn" onClick={openIncome}>{t.dashboard.addIncome}</button>
        </div>
      </div>

      {creditAlerts && (creditAlerts.overdueCount + creditAlerts.dueSoonCount) > 0 && (
        <div
          className={`alert-banner ${creditAlerts.overdueCount > 0 ? 'alert-overdue' : 'alert-duesoon'}`}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/credits')}
        >
          <span className="alert-icon">{creditAlerts.overdueCount > 0 ? '⚠️' : '⏰'}</span>
          <div style={{ flex: 1 }}>
            <strong>{t.notifications.bannerTitle}.</strong>{' '}
            {creditAlerts.overdueCount > 0 &&
              t.notifications.overdue.replace('{count}', creditAlerts.overdueCount)}
            {creditAlerts.overdueCount > 0 && creditAlerts.dueSoonCount > 0 && ' · '}
            {creditAlerts.dueSoonCount > 0 &&
              t.notifications.dueSoon.replace('{count}', creditAlerts.dueSoonCount)}
          </div>
          <span className="link-btn">{t.notifications.viewCredits}</span>
        </div>
      )}

      <div className="grid grid-3">
        <StatCard
          label={`${t.dashboard.availableBalance} (${selCur})`}
          value={selEntry.balance}
          currency={selCur}
          icon="💰"
          color="#6366f1"
          tone={selEntry.balance >= 0 ? 'pos' : 'neg'}
          hint={isBase ? t.dashboard.balanceHint : t.dashboard.balanceHintCurrency.replace('{cur}', selCur)}
        />
        <StatCard label={t.dashboard.totalIncome} value={selEntry.totalIncome} currency={selCur} icon="📈" color="#10b981" />
        <StatCard label={t.dashboard.totalExpenses} value={selEntry.totalExpense} currency={selCur} icon="📉" color="#ef4444" />
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
                  <div className="b-amount">{formatMoney(c.spent, selCur)}</div>
                  <div className="hint" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {t.dashboard.spentOf} {formatMoney(c.budget, selCur)}
                  </div>
                </div>
              </div>
              <div className="progress">
                <span style={{ width: `${c.pct}%`, background: c.over ? 'var(--danger)' : 'var(--success)' }} />
              </div>
              <div className={`b-sub ${c.over ? 'neg' : 'pos'}`}>
                {c.over
                  ? `${t.dashboard.overBudget} ${formatMoney(c.spent - c.budget, selCur)}`
                  : `${formatMoney(c.remaining, selCur)} ${t.dashboard.remaining}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">{t.dashboard.recentActivity}</h2>
      {movementError && (
        <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{movementError}</div>
      )}

      {movements.length > 0 && (
        <div className="activity-toolbar">
          <input
            type="search"
            className="activity-search"
            value={actSearch}
            onChange={(e) => setActSearch(e.target.value)}
            placeholder={t.dashboard.searchPlaceholder}
          />
          <input
            type="date"
            className="activity-date"
            value={actDate}
            onChange={(e) => setActDate(e.target.value)}
          />
          {(actSearch || actDate) && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => { setActSearch(''); setActDate('') }}
            >
              {t.dashboard.clearFilters}
            </button>
          )}
          <div className="activity-spacer" />
          <label className="activity-pagesize">
            {t.dashboard.perPage}
            <select value={actPageSize} onChange={(e) => setActPageSize(Number(e.target.value))}>
              {[5, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}

      {movements.length === 0 ? (
        <div className="empty">{t.dashboard.emptyMovements}</div>
      ) : filteredMovements.length === 0 ? (
        <div className="empty">{t.dashboard.noResults}</div>
      ) : (
        <div className="list">
          {pagedMovements.map((m) => {
            if (m.kind === 'exchange') {
              const incoming = m.dir === 'in'
              return (
                <div className="list-item" key={`exchange-${m.id}-${m.dir}`}>
                  <span className="badge-icon" style={{ background: '#a855f722', color: '#a855f7' }}>🔄</span>
                  <div className="meta">
                    <div className="title">{t.dashboard.exchange}</div>
                    <div className="sub">
                      {incoming
                        ? `${t.dashboard.fromLabel} ${formatMoney(m.otherAmount, m.otherCurrency)}`
                        : `${t.dashboard.toLabel} ${formatMoney(m.otherAmount, m.otherCurrency)}`}
                      {' · '}{formatDate(m.date)}
                    </div>
                  </div>
                  <span className={`amount ${incoming ? 'pos' : 'neg'}`}>
                    {incoming ? '+' : '−'}{formatMoney(m.amount, m.currency)}
                  </span>
                  <button
                    className="btn danger"
                    onClick={() => setConfirm({ message: t.common.confirmDelete, run: () => deleteExchange(m.id) })}
                  >
                    {t.common.delete}
                  </button>
                </div>
              )
            }
            const income = m.kind === 'income'
            return (
              <div className="list-item" key={`${m.kind}-${m.id}`}>
                <span className="badge-icon" style={{
                  background: income ? '#10b98122' : `${m.categoryColor}22`,
                  color: income ? '#10b981' : m.categoryColor,
                }}>
                  {income ? '⬆️' : iconFor(m.categoryIcon)}
                </span>
                <div className="meta">
                  <div className="title">
                    {income ? (m.description || t.common.income) : (m.description || m.categoryName)}
                  </div>
                  <div className="sub">
                    {!income ? `${m.categoryName} · ` : ''}{formatDate(m.date)}
                    {m.paymentMethodName ? ` · 💳 ${m.paymentMethodName}` : ''}
                  </div>
                </div>
                {!income && m.receiptUrl && (
                  <a href={assetUrl(m.receiptUrl)} target="_blank" rel="noreferrer" title={t.common.viewReceipt}>
                    <img className="receipt-thumb" src={assetUrl(m.receiptUrl)} alt="receipt" />
                  </a>
                )}
                <span className={`amount ${income ? 'pos' : 'neg'}`}>
                  {income ? '+' : '−'}{formatMoney(m.amount, m.currency)}
                </span>
                {!income && m.creditId ? (
                  <button
                    className="btn secondary"
                    title={t.expenses.creditLinkedHint}
                    onClick={() => navigate(`/credits/${m.creditId}`)}
                  >
                    {t.expenses.manageInCredits}
                  </button>
                ) : (
                  <>
                    {!income && (
                      <button className="btn secondary" onClick={() => openEditExpense(m)}>{t.common.edit}</button>
                    )}
                    <button
                      className="btn danger"
                      onClick={() =>
                        setConfirm({
                          message: t.common.confirmDelete,
                          run: () => (income ? deleteIncome(m.id) : deleteExpense(m.id)),
                        })
                      }
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

      {filteredMovements.length > 0 && actTotalPages > 1 && (
        <div className="activity-pager">
          <button
            type="button"
            className="btn secondary"
            disabled={actCurrentPage <= 1}
            onClick={() => setActPage((p) => Math.max(1, p - 1))}
          >
            {t.dashboard.prev}
          </button>
          <span className="activity-pageinfo">
            {t.dashboard.pageOf.replace('{page}', actCurrentPage).replace('{total}', actTotalPages)}
          </span>
          <button
            type="button"
            className="btn secondary"
            disabled={actCurrentPage >= actTotalPages}
            onClick={() => setActPage((p) => Math.min(actTotalPages, p + 1))}
          >
            {t.dashboard.next}
          </button>
        </div>
      )}

      {modal === 'income' && (
        <Modal title={t.dashboard.incomeModalTitle} onClose={() => setModal(null)}>
          <form onSubmit={addIncome}>
            <div className="field-row">
              <div className="field" style={{ flex: 2 }}>
                <label>{t.common.amount}</label>
                <input
                  type="number" step="0.01" min="0" autoFocus required
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.common.currency}</label>
                <select
                  value={incomeForm.currency}
                  onChange={(e) => setIncomeForm({ ...incomeForm, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
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
            <div className="field">
              <label>{t.common.paymentMethod} ({t.common.optional})</label>
              <select
                value={incomeForm.paymentMethodId}
                onChange={(e) => setIncomeForm({ ...incomeForm, paymentMethodId: e.target.value })}
              >
                <option value="">{t.common.none}</option>
                {paymentMethods.filter((p) => !p.archived).map((p) => (
                  <option key={p.id} value={p.id}>{pmLabel(p)}</option>
                ))}
              </select>
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setModal(null)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'expense' && (
        <Modal
          title={editingExpenseId ? t.dashboard.editExpenseTitle : t.dashboard.expenseModalTitle}
          onClose={() => setModal(null)}
        >
          <form onSubmit={addExpense}>
            <div className="field-row">
              <div className="field" style={{ flex: 2 }}>
                <label>{t.common.amount}</label>
                <input
                  type="number" step="0.01" min="0" autoFocus required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.common.currency}</label>
                <select
                  value={expenseForm.currency}
                  onChange={(e) => setExpenseForm({ ...expenseForm, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
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
              <label>{t.common.paymentMethod}</label>
              <select
                required
                value={expenseForm.paymentMethodId}
                onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethodId: e.target.value })}
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
              {expenseForm.existingReceiptUrl && !expenseForm.removeReceipt && !expenseForm.receipt ? (
                <div className="receipt-preview">
                  <img src={assetUrl(expenseForm.existingReceiptUrl)} alt="receipt" />
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => setExpenseForm({ ...expenseForm, removeReceipt: true })}
                  >
                    {t.common.remove}
                  </button>
                  <div className="field-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                    {t.common.keepReceiptHint}
                  </div>
                </div>
              ) : (
                <ReceiptInput
                  file={expenseForm.receipt}
                  onChange={(f) => setExpenseForm({ ...expenseForm, receipt: f, removeReceipt: false })}
                />
              )}
            </div>
            {expenseError && (
              <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{expenseError}</div>
            )}
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setModal(null)}>{t.common.cancel}</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? t.common.saving : t.common.save}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'exchange' && (
        <Modal title={t.dashboard.exchangeModalTitle} onClose={() => setModal(null)}>
          <form onSubmit={addExchange}>
            <div className="insight" style={{ marginBottom: 12, fontSize: 13 }}>
              {t.dashboard.exchangeHint}
            </div>
            <div className="field-row">
              <div className="field" style={{ flex: 2 }}>
                <label>{t.dashboard.youSend}</label>
                <input
                  type="number" step="0.01" min="0" autoFocus required
                  value={exchangeForm.fromAmount}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, fromAmount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.common.currency}</label>
                <select
                  value={exchangeForm.fromCurrency}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, fromCurrency: e.target.value })}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>{t.dashboard.rateLabel}</label>
              <div className="rate-row">
                <span className="rate-eq">1 {exchangeForm.fromCurrency} =</span>
                <input
                  type="number" step="any" min="0" required
                  value={exchangeForm.rate}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, rate: e.target.value })}
                  placeholder="0.00"
                />
                <span className="rate-cur">{exchangeForm.toCurrency}</span>
              </div>
              <div className="hint" style={{ marginTop: 6 }}>{t.dashboard.rateHint}</div>
            </div>
            <div className="field-row">
              <div className="field" style={{ flex: 2 }}>
                <label>{t.dashboard.youReceive}</label>
                <input
                  type="number"
                  value={exchangeReceive() || ''}
                  readOnly
                  tabIndex={-1}
                  placeholder="0.00"
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>{t.common.currency}</label>
                <select
                  value={exchangeForm.toCurrency}
                  onChange={(e) => setExchangeForm({ ...exchangeForm, toCurrency: e.target.value })}
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {exchangeForm.fromCurrency === exchangeForm.toCurrency && (
              <div className="field-hint" style={{ color: 'var(--danger)' }}>{t.dashboard.exchangeSameCurrency}</div>
            )}
            {exchangeReceive() > 0 && exchangeForm.fromCurrency !== exchangeForm.toCurrency && (
              <div className="exchange-summary">
                <span className="xs-leg neg">
                  −{formatMoney(parseFloat(exchangeForm.fromAmount) || 0, exchangeForm.fromCurrency)}
                  <em>{exchangeForm.fromCurrency}</em>
                </span>
                <span className="xs-arrow">→</span>
                <span className="xs-leg pos">
                  +{formatMoney(exchangeReceive(), exchangeForm.toCurrency)}
                  <em>{exchangeForm.toCurrency}</em>
                </span>
              </div>
            )}
            <div className="field">
              <label>{t.common.date}</label>
              <input
                type="date"
                value={exchangeForm.date}
                onChange={(e) => setExchangeForm({ ...exchangeForm, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{t.common.description}</label>
              <input
                type="text"
                value={exchangeForm.note}
                onChange={(e) => setExchangeForm({ ...exchangeForm, note: e.target.value })}
                placeholder={t.common.optional}
              />
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setModal(null)}>{t.common.cancel}</button>
              <button
                type="submit"
                className="btn"
                disabled={saving || exchangeForm.fromCurrency === exchangeForm.toCurrency || exchangeReceive() <= 0}
              >
                {saving ? t.common.saving : t.dashboard.exchange}
              </button>
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
