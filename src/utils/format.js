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
export const formatMoney = (value, currency) =>
  new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency: currency || baseCurrency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

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
