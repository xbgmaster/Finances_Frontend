import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ExpensesApi, IncomesApi, CategoriesApi, BalanceApi, ExchangesApi, PaymentMethodsApi, assetUrl } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import ReceiptInput from '../components/ReceiptInput'
import ExpenseCalendar from '../components/ExpenseCalendar'
import { useToast } from '../components/Toast'
import { TrendingUp, TrendingDown, Scale, ArrowLeftRight } from 'lucide-react'
import { formatMoney, formatDate, localDate } from '../utils/format'
import { iconFor, pmTypeIcon } from '../utils/icons'
import { tintVars } from '../utils/color'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const now = new Date()

// Sentinel category id for the built-in, non-deletable "Exchange" bucket (currency transfers).
const EXCHANGE_CAT = '__exchange__'

export default function Expenses() {
  const { t, categoryLabel, accountLabel } = useI18n()
  const { currency: activeCurrency, baseCurrency, setCurrency } = useCurrency()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingEdit, setPendingEdit] = useState(null)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [pmFilter, setPmFilter] = useState('') // '' = all accounts
  const [catFilter, setCatFilter] = useState('') // '' = all categories
  const [searchInput, setSearchInput] = useState('') // bound to the input (filtered client-side)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  // The month's expenses live in the calendar above; the flat list is complementary and
  // stays collapsed until the user searches/filters by account or expands it on demand.
  const [showList, setShowList] = useState(false)
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  // All of the month's expenses / incomes (unpaginated). The calendar plots them and the
  // detail list is derived from these in the browser, so filtering never hits the backend.
  const [monthExpenses, setMonthExpenses] = useState([])
  const [allIncomes, setAllIncomes] = useState([])
  const [exchanges, setExchanges] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState({
    amount: '', description: '', categoryId: '', date: '', currency: '',
    paymentMethodId: '', receipt: null, existingReceiptUrl: null, removeReceipt: false,
  })
  // Income editor (used from the calendar's per-day view).
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [savingIncome, setSavingIncome] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState(null)
  const [incomeError, setIncomeError] = useState('')
  const [incomeForm, setIncomeForm] = useState({
    amount: '', description: '', date: '', currency: '', paymentMethodId: '',
  })

  // Only period + currency trigger a backend load. Filtering by account / category / text
  // and paging are all derived from these results in the browser (no request, no spinner).
  const load = async () => {
    setLoading(true)
    const [cats, sum, monthAll, monthInc, exch, pms] = await Promise.all([
      CategoriesApi.list(),
      BalanceApi.monthly({ year, month, currency: activeCurrency }),
      // Whole month of expenses (drives both the calendar and the detail list).
      ExpensesApi.listPaged({ year, month, currency: activeCurrency, page: 1, pageSize: 1000 })
        .then((r) => r.items).catch(() => []),
      IncomesApi.list().catch(() => []),
      ExchangesApi.list().catch(() => []),
      PaymentMethodsApi.list().catch(() => []),
    ])
    setCategories(cats)
    setSummary(sum)
    setMonthExpenses(monthAll)
    setAllIncomes(monthInc)
    setExchanges(exch)
    setPaymentMethods(pms)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, activeCurrency])

  // Reset to the first page whenever the client-side filters change (no refetch).
  useEffect(() => {
    setPage(1)
  }, [pmFilter, catFilter, searchInput, activeCurrency, year, month, pageSize])

  // Arriving from another page (e.g. Card details "Edit") with an item to edit: switch to its
  // currency/month and remember which item to open once its data has loaded.
  useEffect(() => {
    const edit = location.state?.edit
    if (!edit) return
    if (edit.currency && edit.currency !== activeCurrency) setCurrency(edit.currency)
    if (edit.date) {
      const d = new Date(edit.date)
      setYear(d.getFullYear())
      setMonth(d.getMonth() + 1)
    }
    setPendingEdit({ kind: edit.kind, id: edit.id })
    navigate(location.pathname, { replace: true, state: null }) // don't re-trigger on back/refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Once the target month/currency data is loaded, open the right editor.
  useEffect(() => {
    if (!pendingEdit || loading) return
    if (pendingEdit.kind === 'income') {
      const i = allIncomes.find((x) => String(x.id) === String(pendingEdit.id))
      if (i) { openEditIncome(i); setPendingEdit(null) }
    } else {
      const e = monthExpenses.find((x) => String(x.id) === String(pendingEdit.id))
      if (e) { openEdit(e); setPendingEdit(null) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEdit, loading, monthExpenses, allIncomes])

  const openCreate = async () => {
    setEditingId(null)
    setError('')
    const pms = await ensureCashAccount(activeCurrency)
    // If the list is filtered by an account, default the new expense to that same account.
    const preferredPm = pmFilter && pms.some((p) => String(p.id) === String(pmFilter))
      ? pmFilter
      : bestPm(pms, activeCurrency)
    setForm({
      amount: '',
      description: '',
      categoryId: categories.find((c) => !c.isSystem)?.id ?? '',
      date: localDate(),
      currency: activeCurrency,
      paymentMethodId: preferredPm,
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
      paymentMethodId: e.paymentMethodId ?? defaultPmId(e.currency || activeCurrency),
      receipt: null,
      existingReceiptUrl: e.receiptUrl || null,
      removeReceipt: false,
    })
    setShowModal(true)
  }

  // From the calendar: credit-linked expenses are managed in Credits; others open the editor.
  const onCalendarSelect = (e) => {
    if (e.creditId) navigate(`/credits/${e.creditId}`)
    else openEdit(e)
  }

  // From the calendar "add" button: open a new expense pre-dated to the picked day.
  const openCreateForDate = async (dateStr) => {
    await openCreate()
    if (dateStr) setForm((f) => ({ ...f, date: dateStr }))
  }

  // --- Incomes (managed from the calendar's per-day view) ---
  const openIncomeForDate = async (dateStr) => {
    setEditingIncomeId(null)
    setIncomeError('')
    const pms = await ensureCashAccount(activeCurrency)
    setIncomeForm({
      amount: '',
      description: '',
      date: dateStr || localDate(),
      currency: activeCurrency,
      paymentMethodId: bestNonCreditPm(pms, activeCurrency),
    })
    setShowIncomeModal(true)
  }

  const openEditIncome = (i) => {
    setEditingIncomeId(i.id)
    setIncomeError('')
    setIncomeForm({
      amount: String(i.amount ?? ''),
      description: i.description || '',
      date: i.date ? new Date(i.date).toISOString().slice(0, 10) : '',
      currency: i.currency || activeCurrency,
      paymentMethodId: i.paymentMethodId ?? bestNonCreditPm(paymentMethods, i.currency || activeCurrency),
    })
    setShowIncomeModal(true)
  }

  const submitIncome = async (e) => {
    e.preventDefault()
    const amount = parseFloat(incomeForm.amount)
    if (!amount || amount <= 0) return
    setSavingIncome(true)
    setIncomeError('')
    try {
      const payload = {
        amount,
        description: incomeForm.description,
        date: incomeForm.date ? new Date(incomeForm.date).toISOString() : undefined,
        currency: incomeForm.currency || activeCurrency,
        paymentMethodId: incomeForm.paymentMethodId ? Number(incomeForm.paymentMethodId) : undefined,
      }
      if (editingIncomeId) await IncomesApi.update(editingIncomeId, payload)
      else await IncomesApi.create(payload)
      setShowIncomeModal(false)
      await load()
      toast.success(t.common.savedOk)
    } catch (err) {
      setIncomeError(err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSavingIncome(false)
    }
  }

  const removeIncome = async (id) => {
    try {
      await IncomesApi.remove(id)
      await load()
      toast.success(t.common.deletedOk)
    } catch (err) {
      toast.error(err?.response?.data?.message || t.expenses.deleteError)
    }
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
      toast.success(t.common.savedOk)
    } catch (err) {
      setError(err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    try {
      await ExpensesApi.remove(id)
      await load()
      toast.success(t.common.deletedOk)
    } catch (err) {
      toast.error(err?.response?.data?.message || t.expenses.deleteError)
    }
  }

  const removeExchange = async (id) => {
    try {
      await ExchangesApi.remove(id)
      await load()
      toast.success(t.common.deletedOk)
    } catch (err) {
      toast.error(err?.response?.data?.message || t.expenses.deleteError)
    }
  }

  const goCreateCategory = () => {
    setShowModal(false)
    navigate('/categories', { state: { openCreate: true } })
  }

  const pmLabel = (p) => {
    const type = p.type === 'CreditCard' ? t.cards.typeCreditCard
      : p.type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit
    return `${accountLabel(p.name)} · ${type} · ${p.currency}`
  }

  const pmTypeLabel = (type) =>
    type === 'CreditCard' ? t.cards.typeCreditCard
      : type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit

  // Categories the user can pick manually (system ones like "Debt payments" are hidden).
  const pickableCategories = categories.filter((c) => !c.isSystem)

  // Click a category card to filter the detail list by it; click again to clear.
  const toggleCategory = (id) => {
    setCatFilter((c) => (String(c) === String(id) ? '' : String(id)))
    setPage(1)
  }

  // Best method to preselect within a currency: favorite first, else the first one.
  const bestPm = (pms, cur) => {
    const active = pms.filter((p) => !p.archived && p.currency === cur)
    return String(active.find((p) => p.isFavorite)?.id ?? active[0]?.id ?? '')
  }

  // Income lands in a cash/debit account (never a credit card), so pick the best non-credit one.
  const bestNonCreditPm = (pms, cur) => {
    const active = pms.filter((p) => !p.archived && p.currency === cur && p.type !== 'CreditCard')
    return String(active.find((p) => p.isFavorite)?.id ?? active[0]?.id ?? '')
  }

  const defaultPmId = (cur = activeCurrency) => bestPm(paymentMethods, cur)

  // Ensure a currency always has an account (create a default Cash one if it has none),
  // so the required payment-method field always has a valid option. Returns the fresh list.
  const ensureCashAccount = async (cur) => {
    const c = cur || activeCurrency
    // A null-currency account "follows the base currency", so it counts as an account for the base
    // currency; without this check we'd keep creating duplicate "Cash" accounts for the base lens.
    const existsFor = (p) => !p.archived && (p.currency === c || (!p.currency && c === baseCurrency))
    if (!c || paymentMethods.some(existsFor)) return paymentMethods
    try {
      await PaymentMethodsApi.create({ name: t.cards.typeCash, type: 'Cash', currency: c })
      const pms = await PaymentMethodsApi.list()
      setPaymentMethods(pms)
      return pms
    } catch {
      return paymentMethods
    }
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
  // The account this exchange moves in the active lens: its source when money leaves this currency,
  // or its destination when money arrives. Used so the account filter can include the transfer.
  const exchangeAccountId = (x) => (x.fromCurrency === activeCurrency ? x.fromPaymentMethodId : x.toPaymentMethodId)
  // A transfer is a real movement of the involved account, so it shows under "All accounts" and when
  // that account is selected (source in this lens, destination in the other).
  const visibleExchanges = pmFilter
    ? monthExchanges.filter((x) => String(exchangeAccountId(x)) === String(pmFilter))
    : monthExchanges
  const transfersOut = visibleExchanges
    .filter((x) => x.fromCurrency === activeCurrency)
    .reduce((s, x) => s + x.fromAmount, 0)
  const transfersIn = visibleExchanges
    .filter((x) => x.toCurrency === activeCurrency)
    .reduce((s, x) => s + x.toAmount, 0)
  const transfersNet = transfersIn - transfersOut

  // The month's incomes for the active currency (plotted in green on the calendar).
  const monthIncomes = allIncomes.filter((i) => {
    const d = new Date(i.date)
    const inMonth = d.getFullYear() === year && d.getMonth() + 1 === month
    return inMonth && (i.currency || activeCurrency) === activeCurrency
  })

  // Detail list: filtered + paginated entirely in the browser from the month's expenses,
  // so selecting a category / account / search never triggers a backend request or spinner.
  const q = searchInput.trim().toLowerCase()
  const filteredExpenses = monthExpenses.filter((e) => {
    if (pmFilter && String(e.paymentMethodId) !== String(pmFilter)) return false
    if (catFilter && String(e.categoryId) !== String(catFilter)) return false
    if (q) {
      // Search matches description, category and the amount (so "45.65" or "45" find it too).
      const hay = `${e.description || ''} ${e.categoryName || ''} ${categoryLabel(e.categoryName) || ''} ${e.amount ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  const filteredSum = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const filteredTotal = filteredExpenses.length
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize))
  const currentPage = Math.min(page, totalPages)
  const expenses = filteredExpenses
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // The account filter cascades beyond the detail list: with "All accounts" everything is shown;
  // when a method is picked, the calendar and the category breakdown show only that account's data.
  const calendarExpenses = pmFilter
    ? monthExpenses.filter((e) => String(e.paymentMethodId) === String(pmFilter))
    : monthExpenses
  const calendarIncomes = pmFilter
    ? monthIncomes.filter((i) => String(i.paymentMethodId) === String(pmFilter))
    : monthIncomes
  // Category breakdown: reuse the backend summary for "All accounts"; recompute from the selected
  // account's expenses otherwise (budgets are per-category totals, so they're omitted when scoped).
  const displayByCategory = pmFilter
    ? Object.values(calendarExpenses.reduce((acc, e) => {
        const id = e.categoryId
        if (!acc[id]) {
          acc[id] = {
            categoryId: id,
            categoryName: e.categoryName,
            categoryColor: e.categoryColor,
            categoryIcon: e.categoryIcon,
            spent: 0,
            monthlyBudget: null,
          }
        }
        acc[id].spent += e.amount
        return acc
      }, {})).sort((a, b) => b.spent - a.spent)
    : summary.byCategory

  // "Exchange" behaves like a built-in, non-deletable system category: it groups all the currency
  // exchanges (transfers) so they appear in the breakdown and can be drilled into, without ever
  // being counted as spending. It only shows when there is at least one transfer to represent.
  const exchangeTotal = visibleExchanges.reduce(
    (s, x) => s + (x.fromCurrency === activeCurrency ? x.fromAmount : x.toAmount), 0,
  )
  const hasExchangeCard = visibleExchanges.length > 0

  // Exchanges are transfers (not expenses). Show them as their own small list below the expenses.
  // They respect the account filter (via visibleExchanges) but are hidden while filtering by
  // category or searching text, since transfers have neither.
  const showExchanges = !catFilter && !searchInput.trim() && visibleExchanges.length > 0
  // The flat list opens automatically when a filter/search is active (the calendar can't
  // do those), or when the user expands it manually.
  const listFiltered = !!pmFilter || !!catFilter || !!searchInput.trim()
  const listExpanded = listFiltered || showList

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.expenses.title}</h1>
          <p>{t.expenses.subtitle}</p>
        </div>
        <div className="toolbar">
          <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setPage(1) }}>
            {t.months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1) }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={pmFilter} onChange={(e) => { setPmFilter(e.target.value); setPage(1) }} title={t.expenses.filterByAccount} data-tour="expenses-filter">
            <option value="">{t.expenses.allAccounts}</option>
            {paymentMethods
              .filter((p) => !p.archived && (p.currency === activeCurrency || (!p.currency && activeCurrency === baseCurrency)))
              .map((p) => (
                <option key={p.id} value={p.id}>{accountLabel(p.name)} · {pmTypeLabel(p.type)}</option>
              ))}
          </select>
          <button className="btn" onClick={openCreate}>{t.dashboard.addExpense}</button>
        </div>
      </div>

      <div className="grid grid-3">
        <StatCard label={t.expenses.incomeThisMonth} value={summary.income} currency={activeCurrency} icon={<TrendingUp size={20} />} color="#10b981" />
        <StatCard label={t.expenses.spentThisMonth} value={summary.expense} currency={activeCurrency} icon={<TrendingDown size={20} />} color="#ef4444" />
        <StatCard
          label={t.expenses.remainingThisMonth}
          value={summary.net}
          currency={activeCurrency}
          icon={<Scale size={20} />}
          color="#0f5c4d"
          tone={summary.net >= 0 ? 'pos' : 'neg'}
          hint={t.expenses.remainingHint}
        />
      </div>

      {transfersNet !== 0 && (
        <div className="insight" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge-icon"><ArrowLeftRight size={16} /></span>
          <span>{t.expenses.transfersThisMonth}:</span>
          <strong className={transfersNet < 0 ? 'neg' : 'pos'}>
            {transfersNet < 0 ? '−' : '+'}{formatMoney(Math.abs(transfersNet), activeCurrency)}
          </strong>
          <span className="hint" style={{ color: 'var(--text-muted)' }}>· {t.expenses.transfersHint}</span>
        </div>
      )}

      <h2 className="section-title" data-tour="expenses-calendar">{t.expenses.calendarTitle}</h2>
      <div className="card">
        <ExpenseCalendar
          year={year}
          month={month}
          expenses={calendarExpenses}
          incomes={calendarIncomes}
          exchanges={visibleExchanges}
          currency={activeCurrency}
          t={t}
          categoryLabel={categoryLabel}
          accountLabel={accountLabel}
          onEditExpense={onCalendarSelect}
          onAddExpense={openCreateForDate}
          onEditIncome={openEditIncome}
          onAddIncome={openIncomeForDate}
        />
      </div>

      <h2 className="section-title" data-tour="expenses-categories">{t.expenses.spendingByCategory}</h2>
      {displayByCategory.length === 0 && !hasExchangeCard ? (
        <div className="empty">{t.expenses.noExpensesMonth} {t.months[month - 1]} {year}.</div>
      ) : (
        <div className="grid grid-2">
          {displayByCategory.map((c) => {
            const pct = c.monthlyBudget ? Math.min(100, (c.spent / c.monthlyBudget) * 100) : null
            const over = c.monthlyBudget && c.spent > c.monthlyBudget
            const selected = String(catFilter) === String(c.categoryId)
            return (
              <div
                className={`card cat-card ${selected ? 'selected' : ''}`}
                key={c.categoryId}
                role="button"
                tabIndex={0}
                title={selected ? t.expenses.categoryFilterClear : t.expenses.categoryFilterHint}
                onClick={() => toggleCategory(c.categoryId)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleCategory(c.categoryId) } }}
              >
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
          {hasExchangeCard && (() => {
            const selected = catFilter === EXCHANGE_CAT
            return (
              <div
                className={`card cat-card ${selected ? 'selected' : ''}`}
                key="cat-exchange"
                role="button"
                tabIndex={0}
                title={selected ? t.expenses.categoryFilterClear : t.expenses.categoryFilterHint}
                onClick={() => toggleCategory(EXCHANGE_CAT)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleCategory(EXCHANGE_CAT) } }}
              >
                <div className="row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="badge-icon" style={{ background: '#b8943e22', color: '#b8943e' }}>
                      <ArrowLeftRight size={16} />
                    </span>
                    <div style={{ fontWeight: 600 }}>{t.dashboard.exchange}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{formatMoney(exchangeTotal, activeCurrency)}</div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      <h2 className="section-title" data-tour="expenses-details">{t.expenses.expenseDetails}</h2>
      {!listExpanded ? (
        <div className="empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{t.expenses.listCollapsedHint}</span>
          <button type="button" className="link-btn" onClick={() => setShowList(true)}>{t.expenses.showList}</button>
        </div>
      ) : (
       <>
      {pmFilter && catFilter !== EXCHANGE_CAT && (() => {
        const selectedPm = paymentMethods.find((p) => String(p.id) === String(pmFilter))
        return (
          <div className="insight" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{pmTypeIcon(selectedPm?.type)}</span>
            <span>{selectedPm ? accountLabel(selectedPm.name) : t.expenses.allAccounts}</span>
            <span className="hint" style={{ color: 'var(--text-muted)' }}>· {t.expenses.accountTotal}:</span>
            <strong className="neg">−{formatMoney(filteredSum, activeCurrency)}</strong>
          </div>
        )
      })()}
      {catFilter === EXCHANGE_CAT && (
        <div className="insight" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge-icon" style={{ background: '#b8943e22', color: '#b8943e' }}>
            <ArrowLeftRight size={16} />
          </span>
          <span>{t.dashboard.exchange}</span>
          <span className="hint" style={{ color: 'var(--text-muted)' }}>· {t.expenses.categoryTotal}:</span>
          <strong style={{ color: '#b8943e' }}>{formatMoney(exchangeTotal, activeCurrency)}</strong>
          <button type="button" className="btn secondary" style={{ marginLeft: 'auto' }} onClick={() => toggleCategory(EXCHANGE_CAT)}>
            {t.expenses.showAllCategories}
          </button>
        </div>
      )}
      {catFilter && catFilter !== EXCHANGE_CAT && (() => {
        const selCat = displayByCategory.find((c) => String(c.categoryId) === String(catFilter))
        return (
          <div className="insight" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge-icon" style={{ background: `${selCat?.categoryColor || '#0f5c4d'}22`, color: selCat?.categoryColor || '#0f5c4d' }}>
              {iconFor(selCat?.categoryIcon)}
            </span>
            <span>{selCat ? categoryLabel(selCat.categoryName) : ''}</span>
            <span className="hint" style={{ color: 'var(--text-muted)' }}>· {t.expenses.categoryTotal}:</span>
            <strong className="neg">−{formatMoney(filteredSum, activeCurrency)}</strong>
            <button type="button" className="btn secondary" style={{ marginLeft: 'auto' }} onClick={() => toggleCategory(catFilter)}>
              {t.expenses.showAllCategories}
            </button>
          </div>
        )
      })()}
      {catFilter !== EXCHANGE_CAT && (filteredTotal > 0 || searchInput) && (
        <div className="activity-toolbar">
          <input
            type="search"
            className="activity-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.dashboard.searchPlaceholder}
          />
          {searchInput && (
            <button type="button" className="btn secondary" onClick={() => setSearchInput('')}>
              {t.dashboard.clearFilters}
            </button>
          )}
          <div className="activity-spacer" />
          <label className="activity-pagesize">
            {t.dashboard.perPage}
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}>
              {[5, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}
      {catFilter === EXCHANGE_CAT ? (
        visibleExchanges.length === 0 ? (
          <div className="empty">{t.expenses.noExpenses}</div>
        ) : (
          <div className="list">
            {visibleExchanges
              .slice()
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((x) => {
                const out = x.fromCurrency === activeCurrency
                const amount = out ? x.fromAmount : x.toAmount
                const otherAmount = out ? x.toAmount : x.fromAmount
                const otherCurrency = out ? x.toCurrency : x.fromCurrency
                const accountName = out ? x.fromPaymentMethodName : x.toPaymentMethodName
                return (
                  <div className="list-item tinted" key={`exch-${x.id}`} style={tintVars('#b8943e')}>
                    <span className="badge-icon"><ArrowLeftRight size={16} /></span>
                    <div className="meta">
                      <div className="title">{t.dashboard.exchange}</div>
                      <div className="sub">
                        {out
                          ? `${t.dashboard.toLabel} ${formatMoney(otherAmount, otherCurrency)}`
                          : `${t.dashboard.fromLabel} ${formatMoney(otherAmount, otherCurrency)}`}
                        {accountName ? ` · ${accountLabel(accountName)}` : ''}
                        {' · '}{formatDate(x.date)}
                      </div>
                    </div>
                    <div className="list-item-end">
                      <span className={`amount ${out ? 'neg' : 'pos'}`}>
                        {out ? '−' : '+'}{formatMoney(amount, activeCurrency)}
                      </span>
                      <div className="list-item-actions">
                        <button
                          className="btn danger"
                          onClick={() => setConfirm({ message: t.common.confirmDelete, run: () => removeExchange(x.id) })}
                        >
                          {t.common.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )
      ) : filteredTotal === 0 ? (
        <div className="empty">{searchInput ? t.dashboard.noResults : t.expenses.noExpenses}</div>
      ) : (
        <div className="list">
          {expenses.map((e) => {
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
                    {e.paymentMethodName && (
                      <>
                        {' · '}
                        <span className="pm-inline">
                          {pmTypeIcon(e.paymentMethodType, { size: 13 })}
                          {accountLabel(e.paymentMethodName)} ({pmTypeLabel(e.paymentMethodType)})
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {e.receiptUrl && (
                  <a href={assetUrl(e.receiptUrl)} target="_blank" rel="noreferrer" title={t.common.viewReceipt}>
                    <img className="receipt-thumb" src={assetUrl(e.receiptUrl)} alt="receipt" />
                  </a>
                )}
                <div className="list-item-end">
                  <span className="amount neg">−{formatMoney(e.amount, e.currency || activeCurrency)}</span>
                  <div className="list-item-actions">
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
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filteredTotal > 0 && totalPages > 1 && (
        <div className="activity-pager">
          <button
            type="button"
            className="btn secondary"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t.dashboard.prev}
          </button>
          <span className="activity-pageinfo">
            {t.dashboard.pageOf.replace('{page}', currentPage).replace('{total}', totalPages)}
          </span>
          <button
            type="button"
            className="btn secondary"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t.dashboard.next}
          </button>
        </div>
      )}

      {showList && !listFiltered && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button type="button" className="btn secondary" onClick={() => setShowList(false)}>
            {t.expenses.hideList}
          </button>
        </div>
      )}
      </>
      )}

      {showExchanges && (
        <>
          <h2 className="section-title">{t.expenses.transfersThisMonth}</h2>
          <div className="list">
            {visibleExchanges
              .slice()
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((x) => {
                const out = x.fromCurrency === activeCurrency
                const amount = out ? x.fromAmount : x.toAmount
                const otherAmount = out ? x.toAmount : x.fromAmount
                const otherCurrency = out ? x.toCurrency : x.fromCurrency
                const accountName = out ? x.fromPaymentMethodName : x.toPaymentMethodName
                return (
                  <div className="list-item tinted" key={`exchange-${x.id}`} style={tintVars('#b8943e')}>
                    <span className="badge-icon"><ArrowLeftRight size={16} /></span>
                    <div className="meta">
                      <div className="title">{t.dashboard.exchange}</div>
                      <div className="sub">
                        {out
                          ? `${t.dashboard.toLabel} ${formatMoney(otherAmount, otherCurrency)}`
                          : `${t.dashboard.fromLabel} ${formatMoney(otherAmount, otherCurrency)}`}
                        {accountName ? ` · ${accountName}` : ''}
                        {' · '}{formatDate(x.date)}
                      </div>
                    </div>
                    <div className="list-item-end">
                      <span className={`amount ${out ? 'neg' : 'pos'}`}>
                        {out ? '−' : '+'}{formatMoney(amount, activeCurrency)}
                      </span>
                      <div className="list-item-actions">
                        <button
                          className="btn danger"
                          onClick={() => setConfirm({ message: t.common.confirmDelete, run: () => removeExchange(x.id) })}
                        >
                          {t.common.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </>
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
                <div className="static-field" title={t.dashboard.currencyLensHint}>
                  {form.currency || activeCurrency}
                </div>
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
                {pickableCategories.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c.name)}</option>)}
                <option value="__new__">{t.common.addNewCategory}</option>
              </select>
              {pickableCategories.length === 0 && (
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
                {paymentMethods
                  .filter((p) => !p.archived
                    && (p.currency === form.currency || String(p.id) === String(form.paymentMethodId)))
                  .map((p) => (
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

      {showIncomeModal && (
        <Modal
          title={editingIncomeId ? t.dashboard.editIncomeTitle : t.dashboard.incomeModalTitle}
          onClose={() => setShowIncomeModal(false)}
        >
          <form onSubmit={submitIncome}>
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
                <div className="static-field" title={t.dashboard.currencyLensHint}>
                  {incomeForm.currency || activeCurrency}
                </div>
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
              <label>{t.common.paymentMethod}</label>
              <select
                value={incomeForm.paymentMethodId}
                onChange={(e) => setIncomeForm({ ...incomeForm, paymentMethodId: e.target.value })}
              >
                <option value="">{t.common.select}</option>
                {paymentMethods
                  .filter((p) => !p.archived && p.type !== 'CreditCard'
                    && (p.currency === incomeForm.currency || String(p.id) === String(incomeForm.paymentMethodId)))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{pmLabel(p)}</option>
                  ))}
              </select>
            </div>
            {incomeError && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 12 }}>{incomeError}</div>}
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {editingIncomeId ? (
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => setConfirm({
                    message: t.common.confirmDelete,
                    run: () => { setShowIncomeModal(false); return removeIncome(editingIncomeId) },
                  })}
                >
                  {t.common.delete}
                </button>
              ) : <span />}
              <div className="row" style={{ margin: 0 }}>
                <button type="button" className="btn secondary" onClick={() => setShowIncomeModal(false)}>{t.common.cancel}</button>
                <button type="submit" className="btn" disabled={savingIncome}>{savingIncome ? t.common.saving : t.common.save}</button>
              </div>
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
