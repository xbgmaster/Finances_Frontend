import axios from 'axios'
import { incRequests, decRequests } from '../components/LoadingBar'

// En dev usa el proxy de Vite (/api). En produccion (Render) usa VITE_API_URL
// (p.ej. https://finances-backend-7njx.onrender.com/api) definido en .env.production.
const apiUrl = import.meta.env.VITE_API_URL || '/api'
const api = axios.create({ baseURL: apiUrl })

// Origen del backend para servir archivos estaticos (recibos en /uploads).
// En dev queda vacio (lo resuelve el proxy); en prod apunta al backend.
export const assetBase = apiUrl.replace(/\/api\/?$/, '')
export const assetUrl = (path) => (path && assetBase ? `${assetBase}${path}` : path)

export const TOKEN_KEY = 'finances.token'
export const USER_KEY = 'finances.user'
export const REFRESH_KEY = 'finances.refresh'
export const EXP_KEY = 'finances.expiresAt'

// ---- Session storage helpers (single source of truth in localStorage) ----

export const getStoredRefreshToken = () => localStorage.getItem(REFRESH_KEY)

// Access-token expiry as epoch ms (0 when unknown).
export const getAccessExpiry = () => {
  const v = localStorage.getItem(EXP_KEY)
  const t = v ? new Date(v).getTime() : 0
  return Number.isFinite(t) ? t : 0
}

export const saveSession = (result) => {
  if (result?.token) localStorage.setItem(TOKEN_KEY, result.token)
  if (result?.user) localStorage.setItem(USER_KEY, JSON.stringify(result.user))
  if (result?.refreshToken) localStorage.setItem(REFRESH_KEY, result.refreshToken)
  if (result?.expiresAt) localStorage.setItem(EXP_KEY, result.expiresAt)
}

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(EXP_KEY)
}

const redirectToLogin = () => {
  const path = `${window.location.pathname}${window.location.hash}`
  const onAuth = /\/login|\/register|\/password|\/restore-password/.test(path)
  if (!onAuth) {
    if (import.meta.env.VITE_NATIVE === 'true') window.location.hash = '#/login'
    else window.location.href = '/login'
  }
}

// Clears the session and lets the app (AuthContext) react + redirect.
export const emitLogout = () => {
  clearSession()
  window.dispatchEvent(new Event('finances:logout'))
}

// De-duplicated refresh: concurrent callers share one in-flight request.
let refreshPromise = null
export const refreshAccessToken = () => {
  const rt = getStoredRefreshToken()
  if (!rt) return Promise.reject(new Error('no-refresh-token'))
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh', { refreshToken: rt })
      .then((r) => {
        saveSession(r.data)
        window.dispatchEvent(new Event('finances:refreshed'))
        return r.data
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// Adjunta el token JWT a cada peticion.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  incRequests()
  return config
}, (error) => { decRequests(); return Promise.reject(error) })

// On 401 for a protected call, try ONE silent refresh + retry. If that fails
// (or there is no refresh token), sign out and go to the login page.
api.interceptors.response.use(
  (r) => { decRequests(); return r },
  async (error) => {
    const original = error?.config || {}
    const status = error?.response?.status
    const isAuthCall = /\/auth\//.test(original.url || '')

    if (status === 401 && !isAuthCall) {
      if (!original._retried && getStoredRefreshToken()) {
        original._retried = true
        try {
          const data = await refreshAccessToken()
          original.headers = { ...(original.headers || {}), Authorization: `Bearer ${data.token}` }
          return api(original)
        } catch {
          emitLogout()
          redirectToLogin()
          return Promise.reject(error)
        }
      }
      emitLogout()
      redirectToLogin()
    }
    decRequests()
    return Promise.reject(error)
  },
)

export const AuthApi = {
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }).then((r) => r.data),
  logout: (refreshToken) => api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (data) => api.post('/auth/reset-password', data).then((r) => r.data),
}

export const ProfileApi = {
  get: () => api.get('/profile').then((r) => r.data),
  update: (data) => api.put('/profile', data).then((r) => r.data),
}

export const AdminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data),
  users: (params) => api.get('/admin/users', { params }).then((r) => r.data),
  user: (id) => api.get(`/admin/users/${id}`).then((r) => r.data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  // Set the modules a user is NOT allowed to see (feature blocklist).
  setUserFeatures: (id, disabledFeatures) =>
    api.put(`/admin/users/${id}/features`, { disabledFeatures }).then((r) => r.data),
  setUserRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  exportCsv: (params) => api.get('/admin/reports/export', { params, responseType: 'blob' }).then((r) => r.data),
}

export const CategoriesApi = {
  list: () => api.get('/categories').then((r) => r.data),
  create: (data) => api.post('/categories', data).then((r) => r.data),
  update: (id, data) => api.put(`/categories/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/categories/${id}`),
}

export const IncomesApi = {
  list: (params) => api.get('/incomes', { params }).then((r) => r.data),
  create: (data) => api.post('/incomes', data).then((r) => r.data),
  update: (id, data) => api.put(`/incomes/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/incomes/${id}`),
}

// Recurring incomes ("jobs") with a monthly pay day. Admin-only for now.
export const IncomeSchedulesApi = {
  list: () => api.get('/income-schedules').then((r) => r.data),
  create: (data) => api.post('/income-schedules', data).then((r) => r.data),
  update: (id, data) => api.put(`/income-schedules/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/income-schedules/${id}`),
  // Posts any due pay right now (catch-up), returns { posted }.
  postDue: () => api.post('/income-schedules/post-due').then((r) => r.data),
  // Work shifts for hourly jobs (hours x rate; totaled into income at the pay cut).
  shifts: (year, month) => api.get('/income-schedules/shifts', { params: { year, month } }).then((r) => r.data),
  createShift: (data) => api.post('/income-schedules/shifts', data).then((r) => r.data),
  updateShift: (id, data) => api.put(`/income-schedules/shifts/${id}`, data).then((r) => r.data),
  removeShift: (id) => api.delete(`/income-schedules/shifts/${id}`),
  // For fixed jobs: store a pay-occurrence override (stays SCHEDULED, auto-posted later).
  // For hourly jobs: create income immediately.
  createPayment: (jobId, data) => api.post(`/income-schedules/${jobId}/payments`, data).then((r) => r.data),
  // Occurrence overrides for a month (amount adjustments for specific scheduled pay days).
  occurrenceOverrides: (year, month) =>
    api.get('/income-schedules/occurrence-overrides', { params: { year, month } }).then((r) => r.data),
}

export const PaymentMethodsApi = {
  list: (params) => api.get('/paymentmethods', { params }).then((r) => r.data),
  get: (id) => api.get(`/paymentmethods/${id}`).then((r) => r.data),
  create: (data) => api.post('/paymentmethods', data).then((r) => r.data),
  update: (id, data) => api.put(`/paymentmethods/${id}`, data).then((r) => r.data),
  setFavorite: (id, value) =>
    api.put(`/paymentmethods/${id}/favorite`, null, { params: { value } }).then((r) => r.data),
  remove: (id) => api.delete(`/paymentmethods/${id}`),
  // Credit card payments (reduce debt / free cupo).
  payments: (id) => api.get(`/paymentmethods/${id}/payments`).then((r) => r.data),
  // Card payments funded FROM this account (money that left it to pay a credit card).
  fundedPayments: (id) => api.get(`/paymentmethods/${id}/funded-payments`).then((r) => r.data),
  payCard: (id, data) => api.post(`/paymentmethods/${id}/payments`, data).then((r) => r.data),
  updatePayment: (id, paymentId, data) => api.put(`/paymentmethods/${id}/payments/${paymentId}`, data).then((r) => r.data),
  removePayment: (id, paymentId) => api.delete(`/paymentmethods/${id}/payments/${paymentId}`),
}

export const ExpensesApi = {
  list: (params) => api.get('/expenses', { params }).then((r) => r.data),
  // Server-side pagination (items + total + sum) for large histories.
  listPaged: (params) => api.get('/expenses/paged', { params }).then((r) => r.data),
  // Envia multipart/form-data para admitir la imagen del recibo (opcional).
  create: ({ amount, description, categoryId, date, receipt, currency, paymentMethodId }) => {
    const form = new FormData()
    form.append('amount', amount)
    form.append('categoryId', categoryId)
    if (description) form.append('description', description)
    if (date) form.append('date', date)
    if (currency) form.append('currency', currency)
    if (paymentMethodId) form.append('paymentMethodId', paymentMethodId)
    if (receipt) form.append('receipt', receipt)
    return api.post('/expenses', form).then((r) => r.data)
  },
  // Edit an existing expense. Send a new receipt to replace it, or removeReceipt to clear it.
  update: (id, { amount, description, categoryId, date, receipt, currency, paymentMethodId, removeReceipt }) => {
    const form = new FormData()
    form.append('amount', amount)
    form.append('categoryId', categoryId)
    form.append('description', description ?? '')
    if (date) form.append('date', date)
    if (currency) form.append('currency', currency)
    if (paymentMethodId) form.append('paymentMethodId', paymentMethodId)
    if (removeReceipt) form.append('removeReceipt', 'true')
    if (receipt) form.append('receipt', receipt)
    return api.put(`/expenses/${id}`, form).then((r) => r.data)
  },
  remove: (id) => api.delete(`/expenses/${id}`),
}

export const BalanceApi = {
  get: () => api.get('/balance').then((r) => r.data),
  monthly: (params) => api.get('/balance/monthly', { params }).then((r) => r.data),
  budgetHistory: (params) => api.get('/balance/budget-history', { params }).then((r) => r.data),
}

export const ExchangesApi = {
  list: () => api.get('/exchanges').then((r) => r.data),
  create: (data) => api.post('/exchanges', data).then((r) => r.data),
  update: (id, data) => api.put(`/exchanges/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/exchanges/${id}`),
}

export const ProjectionApi = {
  get: (params) => api.get('/projection', { params }).then((r) => r.data),
}

export const CreditsApi = {
  list: (params) => api.get('/credits', { params }).then((r) => r.data),
  // Credits that need attention right now (due soon / overdue) for the bell + banner.
  alerts: () => api.get('/credits/alerts').then((r) => r.data),
  // Returns the derived "smart summary" of a single credit as of today.
  summary: (id) => api.get(`/credits/${id}`).then((r) => r.data),
  // Full month-by-month amortization table.
  schedule: (id) => api.get(`/credits/${id}/schedule`).then((r) => r.data),
  create: (data) => api.post('/credits', data).then((r) => r.data),
  update: (id, data) => api.put(`/credits/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/credits/${id}`),
  // Payment ledger (list / add / edit / delete). Mutations return the recalculated summary.
  payments: (id) => api.get(`/credits/${id}/payments`).then((r) => r.data),
  addPayment: (id, data) => api.post(`/credits/${id}/payments`, data).then((r) => r.data),
  updatePayment: (id, paymentId, data) =>
    api.put(`/credits/${id}/payments/${paymentId}`, data).then((r) => r.data),
  removePayment: (id, paymentId) => api.delete(`/credits/${id}/payments/${paymentId}`),
}

export default api
