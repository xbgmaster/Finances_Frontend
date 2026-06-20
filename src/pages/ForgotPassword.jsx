import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthApi } from '../api/client'
import { useI18n } from '../i18n/I18nContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function ForgotPassword() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await AuthApi.forgotPassword(email)
      setDone(true)
    } catch {
      setError(t.auth.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar"><LanguageSwitcher /></div>
      <div className="auth-card">
        <div className="auth-brand"><span className="logo">🔑</span><span>{t.auth.restorePassword}</span></div>

        {done ? (
          <>
            <p className="hint">{t.auth.forgotSuccess}</p>
            <Link to="/login" className="btn block" style={{ marginTop: 16, textAlign: 'center' }}>
              {t.auth.signIn}
            </Link>
          </>
        ) : (
          <>
            <p className="hint">{t.auth.forgotSubtitle}</p>
            <form onSubmit={submit}>
              <div className="field">
                <label>{t.auth.email}</label>
                <input type="email" required autoFocus value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn block" disabled={loading}>
                {loading ? t.auth.signingIn : t.auth.sendPassword}
              </button>
            </form>
          </>
        )}

        <p className="auth-switch">{t.auth.haveAccount} <Link to="/login">{t.auth.signIn}</Link></p>
      </div>
    </div>
  )
}
