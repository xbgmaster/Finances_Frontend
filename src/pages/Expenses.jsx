import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExpensesApi, CategoriesApi, BalanceApi, ExchangesApi, PaymentMethodsApi, assetUrl } from '../api/client'
import StatCard from '../components/StatCard'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import ReceiptInput from '../components/ReceiptInput'
import { useToast } from '../components/Toast'
import { TrendingUp, TrendingDown, Scale, ArrowLeftRight } from 'lucide-react'
import { formatMoney, formatDate } from '../utils/format'
import { iconFor, pmTypeIcon } from '../utils/icons'
import { CURRENCIES } from '../utils/currencies'
import { tintVars } from '../utils/color'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'

const now = new Date()

export default function Expenses() {
  const { t, categoryLabel } = useI18n()
  const { currency: activeCurrency } = useCurrency()
  const toast = useToast()
  const navigate = useNavigate()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [pmFilter, setPmFilter] = useState('') // '' = all accounts
  const [searchInput, setSearchInput] = useState('') // bound to the input
  const [search, setSearch] = useState('') // debounced value sent to the server
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [categories, setCategories] = useState([])
  const [summary, setSummary] = useState(null)
  // Server-side paginated expenses: { items, total, page, pageSize, sum }.
  const [expData, setExpData] = useState({ items: [], total: 0, page: 1, pageSize: 5, sum: 0 })
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

  const load = async () => {
    setLoading(true)
    const [cats, sum, paged, exch, pms] = await Promise.all([
      CategoriesApi.list(),
      BalanceApi.monthly({ year, month, currency: activeCurrency }),
      ExpensesApi.listPaged({
        year, month, currency: activeCurrency,
        paymentMethodId: pmFilter || undefined,
        search: search.trim() || undefined,
        page, pageSize,
      }),
      ExchangesApi.list().catch(() => []),
      PaymentMethodsApi.list().catch(() => []),
    ])
    setCategories(cats)
    setSummary(sum)
    setExpData(paged)
    setExchanges(exch)
    setPaymentMethods(pms)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, activeCurrency, pmFilter, page, pageSize, search])

  // Debounce the search box so we don't hit the server on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(id)
  }, [searchInput])

  // Reset to the first page when the currency lens changes (handlers below reset it
  // for month/year/account/page-size directly to avoid a double fetch).
  useEffect(() => {
    setPage(1)
  }, [activeCurrency])

  const openCreate = async () => {
    setEditingId(null)
    setError('')
    const pms = await ensureCashAccount(activeCurrency)
    setForm({
      amount: '',
      description: '',
      categoryId: categories.find((c) => !c.isSystem)?.id ?? '',
      date: new Date().toISOString().slice(0, 10),
      currency: activeCurrency,
      paymentMethodId: bestPm(pms, activeCurrency),
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
    return `${p.name} · ${type} · ${p.currency}`
  }

  const pmTypeLabel = (type) =>
    type === 'CreditCard' ? t.cards.typeCreditCard
      : type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit

  // Categories the user can pick manually (system ones like "Debt payments" are hidden).
  const pickableCategories = categories.filter((c) => !c.isSystem)

  // Best method to preselect within a currency: favorite first, else the first one.
  const bestPm = (pms, cur) => {
    const active = pms.filter((p) => !p.archived && p.currency === cur)
    return String(active.find((p) => p.isFavorite)?.id ?? active[0]?.id ?? '')
  }

  const defaultPmId = (cur = activeCurrency) => bestPm(paymentMethods, cur)

  // Ensure a currency always has an account (create a default Cash one if it has none),
  // so the required payment-method field always has a valid option. Returns the fresh list.
  const ensureCashAccount = async (cur) => {
    const c = cur || activeCurrency
    if (!c || paymentMethods.some((p) => !p.archived && p.currency === c)) return paymentMethods
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
  const transfersOut = monthExchanges
    .filter((x) => x.fromCurrency === activeCurrency)
    .reduce((s, x) => s + x.fromAmount, 0)
  const transfersIn = monthExchanges
    .filter((x) => x.toCurrency === activeCurrency)
    .reduce((s, x) => s + x.toAmount, 0)
  const transfersNet = transfersIn - transfersOut

  // Expense rows come already paginated (and text-filtered) from the server.
  const expenses = expData.items
  // Exchanges are transfers (not expenses). Show them as their own small list below the
  // expenses, and only when we're not filtering expenses by account or search text.
  const showExchanges = !pmFilter && !search.trim() && monthExchanges.length > 0
  const totalPages = Math.max(1, Math.ceil(expData.total / pageSize))
  const currentPage = expData.page || 1

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
          <select value={pmFilter} onChange={(e) => { setPmFilter(e.target.value); setPage(1) }} title={t.expenses.filterByAccount}>
            <option value="">{t.expenses.allAccounts}</option>
            {paymentMethods.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.name} · {pmTypeLabel(p.type)}</option>
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
      {pmFilter && (() => {
        const selectedPm = paymentMethods.find((p) => String(p.id) === String(pmFilter))
        return (
          <div className="insight" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{pmTypeIcon(selectedPm?.type)}</span>
            <span>{selectedPm ? selectedPm.name : t.expenses.allAccounts}</span>
            <span className="hint" style={{ color: 'var(--text-muted)' }}>· {t.expenses.accountTotal}:</span>
            <strong className="neg">−{formatMoney(expData.sum, activeCurrency)}</strong>
          </div>
        )
      })()}
      {(expData.total > 0 || search) && (
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
      {expData.total === 0 ? (
        <div className="empty">{search ? t.dashboard.noResults : t.expenses.noExpenses}</div>
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
                          {e.paymentMethodName} ({pmTypeLabel(e.paymentMethodType)})
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

      {expData.total > 0 && totalPages > 1 && (
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

      {showExchanges && (
        <>
          <h2 className="section-title">{t.expenses.transfersThisMonth}</h2>
          <div className="list">
            {monthExchanges
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
                <select
                  value={form.currency}
                  onChange={async (e) => {
                    const cur = e.target.value
                    const pms = await ensureCashAccount(cur)
                    setForm((f) => ({ ...f, currency: cur, paymentMethodId: bestPm(pms, cur) }))
                  }}
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
