import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'COP', 'ARS', 'BRL', 'CLP']

export default function Onboarding() {
  const { t } = useI18n()
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    country: '',
    currency: 'USD',
    monthlyIncomeTarget: '',
  })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const profile = await ProfileApi.update({
        fullName: form.fullName,
        country: form.country,
        currency: form.currency,
        monthlyIncomeTarget: form.monthlyIncomeTarget === '' ? null : parseFloat(form.monthlyIncomeTarget),
      })
      updateUser({ fullName: profile.fullName, onboardingCompleted: true })
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <LanguageSwitcher />
        <button className="btn secondary" onClick={logout}>{t.auth.logout}</button>
      </div>
      <div className="auth-card">
        <div className="auth-brand"><span className="logo">💰</span><span>{t.appName}</span></div>
        <h1>{t.onboarding.title}</h1>
        <p className="hint">{t.onboarding.subtitle}</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>{t.onboarding.fullName}</label>
            <input type="text" required value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="field">
            <label>{t.onboarding.country}</label>
            <input type="text" value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="field">
            <label>{t.onboarding.currency}</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t.onboarding.monthlyIncomeTarget}</label>
            <input type="number" step="0.01" min="0" value={form.monthlyIncomeTarget}
              onChange={(e) => setForm({ ...form, monthlyIncomeTarget: e.target.value })} placeholder="0.00" />
          </div>
          <button type="submit" className="btn block" disabled={loading}>
            {loading ? t.common.saving : t.onboarding.finish}
          </button>
        </form>
      </div>
    </div>
  )
}
