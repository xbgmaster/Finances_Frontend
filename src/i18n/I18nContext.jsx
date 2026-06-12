import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translations } from './translations'
import { setLocale } from '../utils/format'

const I18nContext = createContext(null)

const STORAGE_KEY = 'finances.lang'
const DEFAULT_LANG = 'en'

const localeFor = (lang) => (lang === 'es' ? 'es-ES' : 'en-US')

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'es' || saved === 'en' ? saved : DEFAULT_LANG
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
    setLocale(localeFor(language))
    document.documentElement.lang = language
  }, [language])

  // Asegura que el locale de formato este listo en el primer render.
  setLocale(localeFor(language))

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggle: () => setLanguage((l) => (l === 'en' ? 'es' : 'en')),
      t: translations[language],
      locale: localeFor(language),
    }),
    [language],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
