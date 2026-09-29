/**
 * Cash available balance for a currency as of the end of a calendar day
 * (inclusive). Mirrors BalanceService cash rules: exclude credit-card charges,
 * include card payments funded from cash/debit, apply exchange legs.
 */
export function cashBalanceAsOf({
  currency,
  asOfEnd,
  baseCurrency,
  incomes = [],
  expenses = [],
  exchanges = [],
  cardPayments = [],
  paymentMethods = [],
}) {
  const creditIds = new Set(
    paymentMethods.filter((p) => p.type === 'CreditCard').map((p) => p.id),
  )
  const end = new Date(asOfEnd)
  end.setHours(23, 59, 59, 999)
  const onOrBefore = (iso) => {
    const d = new Date(iso)
    return !Number.isNaN(d.getTime()) && d <= end
  }
  const curOf = (c) => (!c || c === '' ? baseCurrency : c)

  let income = 0
  let expense = 0
  let exchangeNet = 0

  for (const i of incomes) {
    if (!onOrBefore(i.date)) continue
    if (curOf(i.currency) !== currency) continue
    if (i.paymentMethodId != null && creditIds.has(i.paymentMethodId)) continue
    income += Number(i.amount) || 0
  }
  for (const e of expenses) {
    if (!onOrBefore(e.date)) continue
    if (curOf(e.currency) !== currency) continue
    if (e.paymentMethodId != null && creditIds.has(e.paymentMethodId)) continue
    expense += Number(e.amount) || 0
  }
  for (const p of cardPayments) {
    if (!onOrBefore(p.date)) continue
    if (curOf(p.currency) !== currency) continue
    if (p.sourcePaymentMethodId == null) continue
    expense += Number(p.amount) || 0
  }
  for (const x of exchanges) {
    if (!onOrBefore(x.date)) continue
    if (x.fromCurrency === currency) exchangeNet -= Number(x.fromAmount) || 0
    if (x.toCurrency === currency) exchangeNet += Number(x.toAmount) || 0
  }

  return income - expense + exchangeNet
}

/** Last instant of a calendar month (local). */
export function endOfMonth(year, month) {
  return new Date(year, month, 0, 23, 59, 59, 999)
}

/** Last instant of the month before (year, month). */
export function endOfPreviousMonth(year, month) {
  return new Date(year, month - 1, 0, 23, 59, 59, 999)
}
