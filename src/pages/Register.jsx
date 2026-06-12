import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function Register() {
  const { t } = useI18n()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', fullName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.title || t.auth.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar"><LanguageSwitcher /></div>
      <div className="auth-card">
        <div className="auth-brand"><span className="logo">💰</span><span>{t.appName}</span></div>
        <h1>{t.auth.registerTitle}</h1>
        <p className="hint">{t.auth.registerSubtitle}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>{t.auth.fullName}</label>
            <input type="text" value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div className="field">
            <label>{t.auth.email}</label>
            <input type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" />
          </div>
          <div className="field">
            <label>{t.auth.password}</label>
            <input type="password" required minLength={6} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn block" disabled={loading}>
            {loading ? t.auth.signingIn : t.auth.signUp}
          </button>
        </form>
        <p className="auth-switch">{t.auth.haveAccount} <Link to="/login">{t.auth.signIn}</Link></p>
      </div>
    </div>
  )
}
