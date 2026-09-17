import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PaymentMethodsApi, ExpensesApi, IncomesApi, ExchangesApi } from '../api/client'
import StatCard from '../components/StatCard'
import ConfirmDialog from '../components/ConfirmDialog'
import PayCardModal from '../components/PayCardModal'
import { CreditCard, Wallet, TrendingDown, ArrowUpRight, Receipt, CheckCircle2, Banknote, TrendingUp, ArrowLeftRight } from 'lucide-react'
import { formatMoney, formatDate } from '../utils/format'
import { iconFor, pmTypeIcon } from '../utils/icons'
import { useI18n } from '../i18n/I18nContext'
import { tintVars } from '../utils/color'

export default function CardDetail() {
  const { t, categoryLabel, accountLabel } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const [method, setMethod] = useState(null)
  const [charges, setCharges] = useState([])
  const [incomes, setIncomes] = useState([])
  const [exchanges, setExchanges] = useState([])
  const [payments, setPayments] = useState([])
  const [fundedPayments, setFundedPayments] = useState([])
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPay, setShowPay] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [m, ch, inc, exch, pays, all] = await Promise.all([
        PaymentMethodsApi.get(id),
        ExpensesApi.list({ paymentMethodId: id }),
        IncomesApi.list().catch(() => []),
        ExchangesApi.list().catch(() => []),
        PaymentMethodsApi.payments(id).catch(() => []),
        PaymentMethodsApi.list({ includeArchived: true }).catch(() => []),
      ])
      setMethod(m)
      setCharges(ch)
      setIncomes(inc)
      setExchanges(exch)
      setPayments(pays)
      setMethods(all)

      // Card payments funded FROM this account (money that left it to pay a credit card). Derived
      // from each credit card's payments so it works without a dedicated endpoint. Cards don't fund.
      if (m.type !== 'CreditCard') {
        const creditCards = all.filter((p) => p.type === 'CreditCard')
        const lists = await Promise.all(creditCards.map((c) => PaymentMethodsApi.payments(c.id).catch(() => [])))
        setFundedPayments(lists.flat().filter((p) => String(p.sourcePaymentMethodId) === String(id)))
      } else {
        setFundedPayments([])
      }
    } catch {
      setError(t.cards.loadError)
    }
    setLoading(false)
  }

  const removePayment = async (paymentId) => {
    await PaymentMethodsApi.removePayment(id, paymentId)
    await load()
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const typeLabel = (type) =>
    type === 'CreditCard' ? t.cards.typeCreditCard : type === 'Cash' ? t.cards.typeCash : t.cards.typeDebit

  if (loading) return <div className="loading">{t.common.loading}</div>
  if (error || !method) {
    return (
      <div>
        <button className="btn secondary" onClick={() => navigate('/cards')}>← {t.cards.backToCards}</button>
        <div className="insight" style={{ borderColor: 'var(--danger)', marginTop: 16 }}>{error || t.cards.loadError}</div>
      </div>
    )
  }

  const isCard = method.type === 'CreditCard'
  const cur = method.currency
  const limit = method.creditLimit ?? 0
  const usedPct = isCard && limit > 0 ? Math.min(100, (method.balance / limit) * 100) : 0

  // All movements on this account, in its own currency (matches how the balance is computed):
  // expenses (out), plus — for cash/debit — incomes (in) and currency exchanges (in/out).
  const sameCur = (c) => (c || cur) === cur
  const movements = [
    ...charges.filter((e) => sameCur(e.currency)).map((e) => ({
      key: `e${e.id}`, kind: 'expense', id: e.id, date: e.date, amount: e.amount, sign: -1,
      title: e.description || categoryLabel(e.categoryName),
      sub: `${categoryLabel(e.categoryName)} · ${formatDate(e.date)}`,
      icon: iconFor(e.categoryIcon), color: e.categoryColor || method.color, currency: e.currency || cur,
      editable: !e.creditId, creditId: e.creditId,
    })),
  ]
  if (!isCard) {
    movements.push(...incomes
      .filter((i) => String(i.paymentMethodId) === String(method.id) && sameCur(i.currency))
      .map((i) => ({
        key: `i${i.id}`, kind: 'income', id: i.id, date: i.date, amount: i.amount, sign: 1,
        title: i.description || t.calendar.incomeLabel, sub: formatDate(i.date),
        icon: <TrendingUp size={20} />, color: '#10b981', currency: i.currency || cur, editable: true,
      })))
    movements.push(...exchanges
      .filter((x) => (x.fromPaymentMethodId === method.id && x.fromCurrency === cur)
        || (x.toPaymentMethodId === method.id && x.toCurrency === cur))
      .map((x) => {
        const out = x.fromPaymentMethodId === method.id && x.fromCurrency === cur
        return {
          key: `x${x.id}`, kind: 'exchange', id: x.id, date: x.date,
          amount: out ? x.fromAmount : x.toAmount, sign: out ? -1 : 1,
          title: t.dashboard.exchange, sub: formatDate(x.date),
          icon: <ArrowLeftRight size={20} />, color: '#b8943e', currency: cur, editable: false,
        }
      }))
    // Credit-card payments funded from this account: money leaving it to pay a card (out).
    movements.push(...fundedPayments.map((p) => ({
      key: `f${p.id}`, kind: 'cardpayment', id: p.id, date: p.date, amount: p.amount, sign: -1,
      title: t.cards.paymentTitle,
      sub: `${t.cards.toCard} ${accountLabel(p.creditCardName)} · ${formatDate(p.date)}`,
      icon: <CreditCard size={20} />, color: '#8b5cf6', currency: p.currency || cur, editable: true,
    })))
  }
  movements.sort((a, b) => new Date(b.date) - new Date(a.date))

  // Editing opens the item in Expenses (its home module) with the right month + currency lens.
  const editMovement = (mv) => {
    if (mv.kind === 'expense' && mv.creditId) { navigate(`/credits/${mv.creditId}`); return }
    // Card payments live in Summary's activity (that's where they're edited); the rest in Expenses.
    if (mv.kind === 'cardpayment') { navigate('/', { state: { edit: { kind: 'cardpayment', id: mv.id } } }); return }
    navigate('/expenses', { state: { edit: { kind: mv.kind, id: mv.id, date: mv.date, currency: mv.currency } } })
  }

  return (
    <div>
      <button className="btn secondary" onClick={() => navigate('/cards')}>← {t.cards.backToCards}</button>

      <div className="card method-card" style={{ ...tintVars(method.color), marginTop: 16, marginBottom: 8 }}>
        <div className="page-header row" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="badge-icon">
              {pmTypeIcon(method.type, { size: 22 })}
            </span>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {method.isFavorite && <span title={t.cards.favorite}>⭐</span>}
              {accountLabel(method.name)}
            </h1>
            <p>{typeLabel(method.type)} · {cur}</p>
          </div>
        </div>
        {isCard && <button className="btn" onClick={() => setShowPay(true)}>{t.cards.payAction}</button>}
        </div>
      </div>

      <div className="grid grid-3">
        {isCard ? (
          <>
            <StatCard label={t.cards.limit} value={limit} currency={cur} icon={<CreditCard size={20} />} color={method.color} />
            <StatCard label={t.cards.used} value={method.balance} currency={cur} icon={<Receipt size={20} />} color="#f59e0b" tone="neg" />
            <StatCard
              label={t.cards.available}
              value={method.availableCredit ?? 0}
              currency={cur}
              icon={<CheckCircle2 size={20} />}
              color="#10b981"
              tone={(method.availableCredit ?? 0) < 0 ? 'neg' : 'pos'}
            />
          </>
        ) : (
          <>
            <StatCard
              label={t.cards.balance}
              value={method.balance}
              currency={cur}
              icon={<Wallet size={20} />}
              color={method.color}
              tone={method.balance < 0 ? 'neg' : 'pos'}
            />
            <StatCard label={t.cards.spentThisMonth} value={method.spentThisMonth} currency={cur} icon={<TrendingDown size={20} />} color="#ef4444" />
            <StatCard label={t.cards.receivedThisMonth} value={method.receivedThisMonth} currency={cur} icon={<ArrowUpRight size={20} />} color="#10b981" tone="pos" />
          </>
        )}
      </div>

      {isCard && limit > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="row" style={{ fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {formatMoney(method.balance, cur)} {t.cards.of} {formatMoney(limit, cur)}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>
              {t.cards.spentThisMonth}: {formatMoney(method.spentThisMonth, cur)}
            </span>
          </div>
          <div className="progress">
            <span style={{ width: `${usedPct}%`, background: usedPct >= 100 ? 'var(--danger)' : method.color }} />
          </div>
          {(method.statementDay || method.paymentDueDay) && (
            <div className="row" style={{ fontSize: 13, marginTop: 12, gap: 20, justifyContent: 'flex-start' }}>
              {method.statementDay ? <span style={{ color: 'var(--text-muted)' }}>{t.cards.statementDay}: {method.statementDay}</span> : null}
              {method.paymentDueDay ? <span style={{ color: 'var(--text-muted)' }}>{t.cards.paymentDueDay}: {method.paymentDueDay}</span> : null}
            </div>
          )}
        </div>
      )}

      {isCard && (
        <>
          <h2 className="section-title">{t.cards.paymentsTitle}</h2>
          {payments.length === 0 ? (
            <div className="empty">{t.cards.noPayments}</div>
          ) : (
            <div className="list">
              {payments.map((p) => (
                <div className="list-item" key={p.id}>
                  <span className="badge-icon" style={{ background: '#10b98122', color: '#10b981' }}><Banknote size={20} /></span>
                  <div className="meta">
                    <div className="title">{p.note || t.cards.paymentTitle}</div>
                    <div className="sub">
                      {p.sourcePaymentMethodName
                        ? `${t.cards.payFrom}: ${accountLabel(p.sourcePaymentMethodName)}`
                        : t.cards.externalPayment}
                      {' · '}{formatDate(p.date)}
                    </div>
                  </div>
                  <span className="amount pos">−{formatMoney(p.amount, p.currency)}</span>
                  <button
                    className="btn danger"
                    onClick={() => setConfirm({ message: t.common.confirmDelete, run: () => removePayment(p.id) })}
                  >
                    {t.common.delete}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <h2 className="section-title">{isCard ? t.cards.charges : t.cards.movements}</h2>
      {movements.length === 0 ? (
        <div className="empty">{t.cards.noCharges}</div>
      ) : (
        <div className="list">
          {movements.map((mv) => (
            <div className="list-item tinted" key={mv.key} style={tintVars(mv.color)}>
              <span className="badge-icon">{mv.icon}</span>
              <div className="meta">
                <div className="title">{mv.title}</div>
                <div className="sub">{mv.sub}</div>
              </div>
              <div className="list-item-end">
                <span className={`amount ${mv.sign < 0 ? 'neg' : 'pos'}`}>
                  {mv.sign < 0 ? '−' : '+'}{formatMoney(mv.amount, mv.currency)}
                </span>
                {mv.editable && (
                  <button className="btn secondary" onClick={() => editMovement(mv)}>{t.common.edit}</button>
                )}
                {mv.kind === 'expense' && mv.creditId && (
                  <button className="btn secondary" onClick={() => editMovement(mv)}>{t.calendar.view}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPay && (
        <PayCardModal
          methods={methods}
          preselectedCardId={method.id}
          onClose={() => setShowPay(false)}
          onDone={async () => { setShowPay(false); await load() }}
        />
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
