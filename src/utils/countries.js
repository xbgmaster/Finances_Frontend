import { CURRENCIES } from './currencies'

const fold = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/**
 * Countries that officially (or in daily use) use the app's supported currencies.
 * `en` is the canonical value stored on the user profile.
 */
export const COUNTRIES = [
  { code: 'US', currency: 'USD', en: 'United States', es: 'Estados Unidos', aliases: ['usa', 'eeuu', 'ee.uu.', 'america'] },
  { code: 'EC', currency: 'USD', en: 'Ecuador', es: 'Ecuador' },
  { code: 'SV', currency: 'USD', en: 'El Salvador', es: 'El Salvador' },
  { code: 'PA', currency: 'USD', en: 'Panama', es: 'Panamá' },
  { code: 'PR', currency: 'USD', en: 'Puerto Rico', es: 'Puerto Rico' },
  { code: 'CA', currency: 'CAD', en: 'Canada', es: 'Canadá' },
  { code: 'AT', currency: 'EUR', en: 'Austria', es: 'Austria' },
  { code: 'BE', currency: 'EUR', en: 'Belgium', es: 'Bélgica' },
  { code: 'HR', currency: 'EUR', en: 'Croatia', es: 'Croacia' },
  { code: 'CY', currency: 'EUR', en: 'Cyprus', es: 'Chipre' },
  { code: 'EE', currency: 'EUR', en: 'Estonia', es: 'Estonia' },
  { code: 'FI', currency: 'EUR', en: 'Finland', es: 'Finlandia' },
  { code: 'FR', currency: 'EUR', en: 'France', es: 'Francia' },
  { code: 'DE', currency: 'EUR', en: 'Germany', es: 'Alemania' },
  { code: 'GR', currency: 'EUR', en: 'Greece', es: 'Grecia' },
  { code: 'IE', currency: 'EUR', en: 'Ireland', es: 'Irlanda' },
  { code: 'IT', currency: 'EUR', en: 'Italy', es: 'Italia' },
  { code: 'LV', currency: 'EUR', en: 'Latvia', es: 'Letonia' },
  { code: 'LT', currency: 'EUR', en: 'Lithuania', es: 'Lituania' },
  { code: 'LU', currency: 'EUR', en: 'Luxembourg', es: 'Luxemburgo' },
  { code: 'MT', currency: 'EUR', en: 'Malta', es: 'Malta' },
  { code: 'NL', currency: 'EUR', en: 'Netherlands', es: 'Países Bajos', aliases: ['holland', 'holanda'] },
  { code: 'PT', currency: 'EUR', en: 'Portugal', es: 'Portugal' },
  { code: 'SK', currency: 'EUR', en: 'Slovakia', es: 'Eslovaquia' },
  { code: 'SI', currency: 'EUR', en: 'Slovenia', es: 'Eslovenia' },
  { code: 'ES', currency: 'EUR', en: 'Spain', es: 'España' },
  { code: 'AD', currency: 'EUR', en: 'Andorra', es: 'Andorra' },
  { code: 'GB', currency: 'GBP', en: 'United Kingdom', es: 'Reino Unido', aliases: ['uk', 'britain', 'gran bretana', 'england', 'inglaterra'] },
  { code: 'MX', currency: 'MXN', en: 'Mexico', es: 'México' },
  { code: 'CO', currency: 'COP', en: 'Colombia', es: 'Colombia' },
  { code: 'AR', currency: 'ARS', en: 'Argentina', es: 'Argentina' },
  { code: 'BR', currency: 'BRL', en: 'Brazil', es: 'Brasil' },
  { code: 'CL', currency: 'CLP', en: 'Chile', es: 'Chile' },
].filter((c) => CURRENCIES.includes(c.currency))

export const countryLabel = (country, language) =>
  language === 'es' ? country.es : country.en

export function findCountry(value) {
  const q = fold(value)
  if (!q) return null
  return COUNTRIES.find((c) =>
    [c.code, c.en, c.es, c.currency, ...(c.aliases || [])].some((part) => fold(part) === q),
  ) || null
}

export function searchCountries(query, language) {
  const q = fold(query)
  const ranked = COUNTRIES.map((c) => ({
    ...c,
    label: countryLabel(c, language),
  })).sort((a, b) => a.label.localeCompare(b.label, language === 'es' ? 'es' : 'en'))

  if (!q) return ranked
  return ranked.filter((c) =>
    [c.code, c.en, c.es, c.currency, c.label, ...(c.aliases || [])].some((part) => fold(part).includes(q)),
  )
}
