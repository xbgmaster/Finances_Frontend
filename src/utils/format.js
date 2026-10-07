// Locale actual usado por los formateadores. Lo actualiza el I18nProvider.
let currentLocale = 'en-US'

// Moneda base del usuario (de su perfil). La usa formatMoney cuando no se pasa
// una moneda explicita. La actualiza AuthContext cuando cambia el usuario.
let baseCurrency = 'CAD'

export const setLocale = (locale) => {
  currentLocale = locale
}

export const setBaseCurrency = (code) => {
  if (code) baseCurrency = code
}

export const getBaseCurrency = () => baseCurrency

// Formatea un monto. Si no se pasa 'currency', usa la moneda base del usuario.
const AMOUNT_LOCALE = {
  CAD: 'en-CA', USD: 'en-US', COP: 'es-CO', CLP: 'es-CL',
  EUR: 'de-DE', GBP: 'en-GB', MXN: 'es-MX', ARS: 'es-AR', BRL: 'pt-BR',
}

export const amountLocale = (currency) => AMOUNT_LOCALE[currency] || AMOUNT_LOCALE[baseCurrency] || 'en-CA'

export const formatAmount = (value, currency) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat(amountLocale(currency), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export const parseAmount = (text, currency) => {
  if (text == null || String(text).trim() === '') return NaN
  const parts = new Intl.NumberFormat(amountLocale(currency)).formatToParts(12345.6)
  const group = parts.find((p) => p.type === 'group')?.value || ','
  const decimal = parts.find((p) => p.type === 'decimal')?.value || '.'
  let s = String(text).trim().replace(/\s/g, '')
  if (group) s = s.split(group).join('')
  if (decimal !== '.') s = s.replace(decimal, '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export const formatMoney = (value, currency) => {
  const code = currency || baseCurrency
  try {
    return new Intl.NumberFormat(amountLocale(code), {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
    }).format(Number(value || 0))
  } catch {
    return formatAmount(value, code)
  }
}

/**
 * Returns today's date as "YYYY-MM-DD" in the device's LOCAL timezone.
 * `new Date().toISOString()` uses UTC, which shows tomorrow after ~5 pm
 * in UTC-7 (PT) — this is the correct alternative.
 */
export const localDate = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(currentLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
