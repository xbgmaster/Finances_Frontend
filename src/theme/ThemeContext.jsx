import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applyNativeTheme } from '../native'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'finances.theme'

const systemTheme = () =>
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const THEME_COLOR = { light: '#f3f0e8', dark: '#0f1512' }

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : systemTheme()
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_COLOR[theme])
    // Keep the native status bar in sync when running inside the APK.
    applyNativeTheme(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggle: () => setTheme((x) => (x === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
