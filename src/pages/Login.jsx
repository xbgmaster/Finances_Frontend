import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function Login() {
  const { t } = useI18n()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      const dest = !user.onboardingCompleted ? '/onboarding' : location.state?.from?.pathname || '/'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err?.response?.status === 400 ? t.auth.invalidCredentials : t.auth.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar"><LanguageSwitcher /></div>
      <div className="auth-card">
        <div className="auth-brand"><span className="logo">💰</span><span>{t.appName}</span></div>
        <h1>{t.auth.loginTitle}</h1>
        <p className="hint">{t.auth.loginSubtitle}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>{t.auth.email}</label>
            <input type="email" required autoFocus value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" />
          </div>
          <div className="field">
            <label>{t.auth.password}</label>
            <input type="password" required value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn block" disabled={loading}>
            {loading ? t.auth.signingIn : t.auth.signIn}
          </button>
        </form>
        <p className="auth-switch">{t.auth.noAccount} <Link to="/register">{t.auth.signUp}</Link></p>
      </div>
    </div>
  )
}
