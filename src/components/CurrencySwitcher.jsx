import { useCurrency } from '../currency/CurrencyContext'
import { CURRENCIES } from '../utils/currencies'
import { useI18n } from '../i18n/I18nContext'

export default function CurrencySwitcher() {
  const { currency, setCurrency, baseCurrency } = useCurrency()
  const { t } = useI18n()

  // Always include the base currency even if it's not in the shared list.
  const options = CURRENCIES.includes(baseCurrency) ? CURRENCIES : [baseCurrency, ...CURRENCIES]

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
