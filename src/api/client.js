import axios from 'axios'

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

// Adjunta el token JWT a cada peticion.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si el token expira o es invalido (401), cierra sesion y va al login.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      const path = window.location.pathname
      if (path !== '/login' && path !== '/register') window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export const AuthApi = {
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
}

export const ProfileApi = {
  get: () => api.get('/profile').then((r) => r.data),
  update: (data) => api.put('/profile', data).then((r) => r.data),
}

export const AdminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data),
  users: (params) => api.get('/admin/users', { params }).then((r) => r.data),
  user: (id) => api.get(`/admin/users/${id}`).then((r) => r.data),
  exportCsv: (params) => api.get('/admin/reports/export', { params, responseType: 'blob' }).then((r) => r.data),
}

export const CategoriesApi = {
  list: () => api.get('/categories').then((r) => r.data),
  create: (data) => api.post('/categories', data).then((r) => r.data),
  update: (id, data) => api.put(`/categories/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/categories/${id}`),
}

export const IncomesApi = {
  list: () => api.get('/incomes').then((r) => r.data),
  create: (data) => api.post('/incomes', data).then((r) => r.data),
  remove: (id) => api.delete(`/incomes/${id}`),
}

export const ExpensesApi = {
  list: (params) => api.get('/expenses', { params }).then((r) => r.data),
  // Envia multipart/form-data para admitir la imagen del recibo (opcional).
  create: ({ amount, description, categoryId, date, receipt }) => {
    const form = new FormData()
    form.append('amount', amount)
    form.append('categoryId', categoryId)
    if (description) form.append('description', description)
    if (date) form.append('date', date)
    if (receipt) form.append('receipt', receipt)
    return api.post('/expenses', form).then((r) => r.data)
  },
  remove: (id) => api.delete(`/expenses/${id}`),
}

export const BalanceApi = {
  get: () => api.get('/balance').then((r) => r.data),
  monthly: (params) => api.get('/balance/monthly', { params }).then((r) => r.data),
}

export const ProjectionApi = {
  get: (params) => api.get('/projection', { params }).then((r) => r.data),
}

export default api
