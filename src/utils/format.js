// Locale actual usado por los formateadores. Lo actualiza el I18nProvider.
let currentLocale = 'en-US'

export const setLocale = (locale) => {
  currentLocale = locale
}

export const formatMoney = (value) =>
  new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(currentLocale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
