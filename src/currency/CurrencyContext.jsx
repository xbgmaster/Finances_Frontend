import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const CurrencyContext = createContext(null)

const STORAGE_KEY = 'finances.currency'

/**
 * Global "currency lens": the whole app shows money in a single currency at a time (like the
 * language switch). Currencies are never converted; switching just filters what you see.
 * Until the user explicitly picks one, it follows their base (profile) currency.
 */
export function CurrencyProvider({ children }) {
  const { user } = useAuth()
  const baseCurrency = user?.currency || 'CAD'

  const [currency, setCurrencyState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || baseCurrency,
  )

  // While the user hasn't chosen a lens, follow their base currency as it loads/changes.
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setCurrencyState(baseCurrency)
  }, [baseCurrency])

  const setCurrency = (code) => {
    if (!code) return
    localStorage.setItem(STORAGE_KEY, code)
    setCurrencyState(code)
  }

  const value = useMemo(
    () => ({ currency, setCurrency, baseCurrency }),
    [currency, baseCurrency],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
