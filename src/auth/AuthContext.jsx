import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  AuthApi,
  TOKEN_KEY,
  USER_KEY,
  saveSession,
  clearSession,
  refreshAccessToken,
  getStoredRefreshToken,
  getAccessExpiry,
} from '../api/client'
import { setBaseCurrency } from '../utils/format'
import { isFeatureVisible } from '../features/registry'

// Sign the user out after this long without any interaction.
const INACTIVITY_MS = 10 * 60 * 1000
// How often we check idle time / token freshness.
const CHECK_EVERY_MS = 30 * 1000
// Refresh the access token proactively once it has less than this left.
const REFRESH_BEFORE_MS = 3 * 60 * 1000

const AuthContext = createContext(null)

const readUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(readUser)
  const lastActivityRef = useRef(Date.now())

  // Keep the money formatter's default currency in sync with the user's base currency.
  useEffect(() => {
    setBaseCurrency(user?.currency || 'CAD')
  }, [user])

  const persist = (result) => {
    saveSession(result)
    setToken(result.token)
    setUser(result.user)
  }

  const login = async (email, password) => {
    const result = await AuthApi.login({ email, password })
    persist(result)
    return result.user
  }

  const register = async (data) => {
    const result = await AuthApi.register(data)
    persist(result)
    return result.user
  }

  const logout = () => {
    // Best-effort server-side revoke so a leaked refresh token can't be reused.
    const rt = getStoredRefreshToken()
    if (rt) AuthApi.logout(rt).catch(() => {})
    clearSession()
    setToken(null)
    setUser(null)
  }

  // Session lifecycle: track activity, refresh the token while active, and sign out
  // after INACTIVITY_MS of no interaction. Only runs while there is a session.
  useEffect(() => {
    if (!token) return

    const markActive = () => { lastActivityRef.current = Date.now() }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }))

    const tick = async () => {
      // 1) Inactive for too long -> sign out and let the route guard send to /login.
      if (Date.now() - lastActivityRef.current >= INACTIVITY_MS) {
        logout()
        return
      }
      // 2) Still active: keep the access token fresh before it expires.
      if (getStoredRefreshToken() && getAccessExpiry() - Date.now() < REFRESH_BEFORE_MS) {
        try {
          const data = await refreshAccessToken()
          setToken(data.token)
        } catch {
          logout()
        }
      }
    }
    const intervalId = setInterval(tick, CHECK_EVERY_MS)

    // React to logouts / refreshes triggered outside React (axios interceptor).
    const onLogout = () => { setToken(null); setUser(null) }
    // Refresh persists a fresh user too (incl. feature flags); mirror it into state.
    const onRefreshed = () => { setToken(localStorage.getItem(TOKEN_KEY)); setUser(readUser()) }
    window.addEventListener('finances:logout', onLogout)
    window.addEventListener('finances:refreshed', onRefreshed)

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive))
      clearInterval(intervalId)
      window.removeEventListener('finances:logout', onLogout)
      window.removeEventListener('finances:refreshed', onRefreshed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Permite actualizar los datos del usuario (p.ej. tras completar el perfil).
  const updateUser = (partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial }
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      return next
    })
  }

  const isAdmin = user?.role === 'Admin'
  // The stored set holds hidden opt-out modules and granted opt-in modules (see registry).
  const userRole = user?.role || 'User'   // 'Admin' | 'Premium' | 'User'
  const featureOverrides = user?.disabledFeatures || []
  // Admins bypass all feature gates; other roles use the role-aware visibility function.
  const canAccess = (key) => !key || isAdmin || isFeatureVisible(key, featureOverrides, userRole)

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: !!token,
      isAdmin,
      userRole,
      featureOverrides,
      canAccess,
      login,
      register,
      logout,
      updateUser,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
