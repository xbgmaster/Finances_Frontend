import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ProfileApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import BrandLogo from '../components/BrandLogo'
import AuthLaserBackground from '../components/AuthLaserBackground'
import CountrySelect from '../components/CountrySelect'
import { CURRENCIES } from '../utils/currencies'
import { findCountry } from '../utils/countries'

export default function Onboarding() {
  const { t } = useI18n()
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const passed = location.state || {}
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    country: passed.country || '',
    currency: passed.currency || user?.currency || 'CAD',
    monthlyIncomeTarget: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    ProfileApi.get()
      .then((p) => {
        if (!active) return
        setForm((f) => ({
          ...f,
          fullName: f.fullName || p.fullName || '',
          country: f.country || p.country || '',
          currency: f.currency || p.currency || 'CAD',
          monthlyIncomeTarget: f.monthlyIncomeTarget || p.monthlyIncomeTarget || '',
        }))
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const match = findCountry(form.country)
      const profile = await ProfileApi.update({
        fullName: form.fullName,
        country: match ? match.en : form.country,
        currency: match?.currency || form.currency,
        monthlyIncomeTarget: form.monthlyIncomeTarget === '' ? null : parseFloat(form.monthlyIncomeTarget),
      })
      updateUser({ fullName: profile.fullName, onboardingCompleted: true, currency: profile.currency })
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page auth-page--laser">
      <AuthLaserBackground />
      <div className="auth-topbar">
        <LanguageSwitcher />
        <button className="btn secondary" onClick={logout}>{t.auth.logout}</button>
      </div>
      <div className="auth-card">
        <div className="auth-brand"><BrandLogo className="logo" size={40} /><span>{t.appName}</span></div>
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
            <CountrySelect
              value={form.country}
              onChange={(c) => setForm({
                ...form,
                country: c ? c.en : '',
                currency: c ? c.currency : form.currency,
              })}
            />
            <div className="hint" style={{ marginTop: 6 }}>{t.common.countryHint}</div>
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
