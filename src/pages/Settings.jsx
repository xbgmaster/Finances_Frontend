import { useEffect, useState } from 'react'
import { ProfileApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n/I18nContext'
import { useCurrency } from '../currency/CurrencyContext'
import { CURRENCIES } from '../utils/currencies'

export default function Settings() {
  const { t } = useI18n()
  const { user, updateUser } = useAuth()
  const { currency: activeCurrency, setCurrency } = useCurrency()
  const [form, setForm] = useState(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ProfileApi.get()
      .then((p) => {
        if (!active) return
        setEmail(p.email || '')
        setForm({
          fullName: p.fullName || '',
          country: p.country || '',
          currency: p.currency || 'CAD',
          monthlyIncomeTarget: p.monthlyIncomeTarget ?? '',
        })
      })
      .catch(() => setError(t.settings.loadError))
      .finally(() => active && setLoading(false))
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.fullName.trim()) return
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const prevCurrency = user?.currency
      const profile = await ProfileApi.update({
        fullName: form.fullName.trim(),
        country: form.country.trim(),
        currency: form.currency,
        monthlyIncomeTarget: form.monthlyIncomeTarget === '' ? null : parseFloat(form.monthlyIncomeTarget),
      })
      updateUser({
        fullName: profile.fullName,
        currency: profile.currency,
        onboardingCompleted: true,
      })
      // If the base currency changed and the lens was showing the old base, follow the new base.
      if (profile.currency !== prevCurrency && activeCurrency === prevCurrency) {
        setCurrency(profile.currency)
      }
      setSaved(true)
    } catch (err) {
      setError(err?.response?.data?.message || t.settings.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) return <div className="loading">{t.common.loading}</div>

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>{t.settings.title}</h1>
        <p>{t.settings.subtitle}</p>
      </div>

      {error && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={submit}>
          <div className="field">
            <label>{t.settings.email}</label>
            <input type="email" value={email} disabled readOnly />
            <div className="hint" style={{ marginTop: 6 }}>{t.settings.emailHint}</div>
          </div>

          <div className="field">
            <label>{t.settings.fullName}</label>
            <input
              type="text" required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>

          <div className="field">
            <label>{t.settings.country}</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </div>

          <div className="field">
            <label>{t.settings.baseCurrency}</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="hint" style={{ marginTop: 6 }}>{t.settings.baseCurrencyHint}</div>
          </div>

          <div className="field">
            <label>{t.settings.monthlyIncomeTarget}</label>
            <input
              type="number" step="0.01" min="0"
              value={form.monthlyIncomeTarget}
              onChange={(e) => setForm({ ...form, monthlyIncomeTarget: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="row" style={{ alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? t.common.saving : t.common.saveChanges}
            </button>
            {saved && <span className="pos" style={{ fontWeight: 600 }}>{t.settings.saved}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
