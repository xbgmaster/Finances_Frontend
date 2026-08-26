import { useEffect, useState } from 'react'
import { useCurrency } from '../currency/CurrencyContext'
import { CURRENCIES } from '../utils/currencies'
import { useI18n } from '../i18n/I18nContext'
import { BalanceApi, CreditsApi } from '../api/client'

export default function CurrencySwitcher() {
  const { currency, setCurrency, baseCurrency } = useCurrency()
  const { t } = useI18n()
  const [used, setUsed] = useState([])

  // Currencies that actually have movements (balance/summary) or credits, to surface them first.
  useEffect(() => {
    let active = true
    const loadUsed = async () => {
      try {
        const [balance, credits] = await Promise.all([
          BalanceApi.get().catch(() => null),
          CreditsApi.list().catch(() => []),
        ])
        const set = new Set()
        for (const c of balance?.byCurrency ?? []) {
          if (c.totalIncome > 0 || c.totalExpense > 0 || c.balance !== 0) set.add(c.currency)
        }
        for (const cr of credits ?? []) set.add(cr.currency || baseCurrency)
        if (active) setUsed([...set])
      } catch {
        if (active) setUsed([])
      }
    }
    loadUsed()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCurrency])

  const azSort = (a, b) => a.localeCompare(b)

  // 1) base first, 2) currencies with movements (A-Z), 3) the rest (A-Z).
  const usedSet = new Set(used)
  const withMovements = CURRENCIES
    .filter((c) => c !== baseCurrency && usedSet.has(c))
    .sort(azSort)
  const rest = CURRENCIES
    .filter((c) => c !== baseCurrency && !usedSet.has(c))
    .sort(azSort)
  const options = [baseCurrency, ...withMovements, ...rest]

  return (
    <div className="currency-switch-top" title={t.common.viewCurrencyHint}>
      <span className="cst-icon">💱</span>
      <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label={t.dashboard.viewCurrency}>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}{c === baseCurrency ? ` · ${t.dashboard.baseTag}` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
