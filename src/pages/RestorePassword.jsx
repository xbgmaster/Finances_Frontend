import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthApi } from '../api/client'
import { useI18n } from '../i18n/I18nContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

// Page reached from the password reset email link:
//   /restore-password?email=<email>&token=<reset-token>
// The user sets a new password, which is sent to POST /api/auth/reset-password.
export default function RestorePassword() {
  const { t } = useI18n()
  const [params] = useSearchParams()

  // useSearchParams already URL-decodes the values.
  const email = params.get('email') || ''
  const token = params.get('token') || ''
  const linkValid = useMemo(() => Boolean(email && token), [email, token])

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError(t.auth.passwordsMismatch)
      return
    }

    setLoading(true)
    try {
      await AuthApi.resetPassword({ email, token, newPassword: form.password })
      setDone(true)
    } catch (err) {
      // Backend returns 400 with a ProblemDetails "detail" message on failure.
      setError(err?.response?.data?.detail || t.auth.genericError)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-topbar"><LanguageSwitcher /></div>
      <div className="auth-card">
        <div className="auth-brand"><span className="logo">🔑</span><span>{t.auth.resetTitle}</span></div>

        {done ? (
          <>
            <p className="hint">{t.auth.resetSuccess}</p>
            <div className="auth-actions">
              <Link to="/login" className="btn">{t.auth.signIn}</Link>
            </div>
          </>
        ) : !linkValid ? (
          <>
            {/* The link is missing the email/token query parameters. */}
            <div className="auth-error">{t.auth.resetInvalidLink}</div>
            <div className="auth-actions">
              <Link to="/password" className="btn">{t.auth.restorePassword}</Link>
            </div>
          </>
        ) : (
          <>
            <p className="hint">{t.auth.resetSubtitle}</p>
            <form onSubmit={submit}>
              <div className="field">
                <label>{t.auth.newPassword}</label>
                <input type="password" required minLength={6} autoFocus value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div className="field">
                <label>{t.auth.confirmPassword}</label>
                <input type="password" required minLength={6} value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="••••••••" />
              </div>
              <br></br>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn block" disabled={loading}>
                {loading ? t.auth.signingIn : t.auth.resetButton}
              </button>
            </form>
          </>
        )}

        <p className="auth-switch">{t.auth.haveAccount} <Link to="/login">{t.auth.signIn}</Link></p>
      </div>
    </div>
  )
}
