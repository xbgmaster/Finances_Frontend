import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PaymentMethodsApi, ExpensesApi } from '../api/client'
import StatCard from '../components/StatCard'
import ConfirmDialog from '../components/ConfirmDialog'
import PayCardModal from '../components/PayCardModal'
import { formatMoney, formatDate } from '../utils/format'
import { iconFor } from '../utils/icons'
import { useI18n } from '../i18n/I18nContext'
import { tintVars } from '../utils/color'

const typeIcon = (type) => (type === 'CreditCard' ? '💳' : type === 'Cash' ? '💵' : '🏦')

export default function CardDetail() {
  const { t, categoryLabel } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const [method, setMethod] = useState(null)
  const [charges, setCharges] = useState([])
  const [payments, setPayments] = useState([])
  const [methods, setMethods] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPay, setShowPay] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [m, ch, pays, all] = await Promise.all([
        PaymentMethodsApi.get(id),
        ExpensesApi.list({ paymentMethodId: id }),
        PaymentMethodsApi.payments(id).catch(() => []),
        PaymentMethodsApi.list({ includeArchived: true }).catch(() => []),
      ])
      setMethod(m)
      setCharges(ch)
      setPayments(pays)
      setMethods(all)
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

  return (
    <div>
      <button className="btn secondary" onClick={() => navigate('/cards')}>← {t.cards.backToCards}</button>

      <div className="card method-card" style={{ ...tintVars(method.color), marginTop: 16, marginBottom: 8 }}>
        <div className="page-header row" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="badge-icon">
              {typeIcon(method.type)}
            </span>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {method.isFavorite && <span title={t.cards.favorite}>⭐</span>}
              {method.name}
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
            <StatCard label={t.cards.limit} value={limit} currency={cur} icon="💳" color={method.color} />
            <StatCard label={t.cards.used} value={method.balance} currency={cur} icon="🧾" color="#f59e0b" tone="neg" />
            <StatCard
              label={t.cards.available}
              value={method.availableCredit ?? 0}
              currency={cur}
              icon="✅"
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
              icon="💰"
              color={method.color}
              tone={method.balance < 0 ? 'neg' : 'pos'}
            />
            <StatCard label={t.cards.spentThisMonth} value={method.spentThisMonth} currency={cur} icon="💸" color="#ef4444" />
            <StatCard label={t.cards.receivedThisMonth} value={method.receivedThisMonth} currency={cur} icon="⬆️" color="#10b981" tone="pos" />
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
                  <span className="badge-icon" style={{ background: '#10b98122', color: '#10b981' }}>✅</span>
                  <div className="meta">
                    <div className="title">{p.note || t.cards.paymentTitle}</div>
                    <div className="sub">
                      {p.sourcePaymentMethodName
                        ? `${t.cards.payFrom}: ${p.sourcePaymentMethodName}`
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

      <h2 className="section-title">{t.cards.charges}</h2>
      {charges.length === 0 ? (
        <div className="empty">{t.cards.noCharges}</div>
      ) : (
        <div className="list">
          {charges.map((e) => (
            <div className="list-item tinted" key={e.id} style={tintVars(method.color)}>
              <span className="badge-icon">
                {iconFor(e.categoryIcon)}
              </span>
              <div className="meta">
                <div className="title">{e.description || categoryLabel(e.categoryName)}</div>
                <div className="sub">{categoryLabel(e.categoryName)} · {formatDate(e.date)}</div>
              </div>
              <span className="amount neg">−{formatMoney(e.amount, e.currency || cur)}</span>
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
