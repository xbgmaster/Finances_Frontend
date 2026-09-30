import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useI18n } from '../i18n/I18nContext'

const GIS = 'https://accounts.google.com/gsi/client'
const WEB_CLIENT_ID = '487523170626-r9hgc3ocogoiuthbv9tbdinnhln7n23p.apps.googleusercontent.com'
const isNativeApp = () =>
  import.meta.env.VITE_NATIVE === 'true' || Capacitor.isNativePlatform()

function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('gis')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = GIS
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('gis'))
    document.head.appendChild(script)
  })
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.2l6.3 5.3C37.4 38.4 44 33 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}

export default function GoogleSignInButton({ onCredential, disabled }) {
  const { t } = useI18n()
  const host = useRef(null)
  const callback = useRef(onCredential)
  callback.current = onCredential
  const [ready, setReady] = useState(true)
  const [nativeError, setNativeError] = useState('')

  useEffect(() => {
    if (isNativeApp()) {
      setReady(true)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        if (cancelled) return
        await loadGis()
        if (cancelled || !host.current) return
        const googleId = window.google.accounts.id
        googleId.initialize({
          client_id: WEB_CLIENT_ID,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (resp) => {
            if (resp?.credential) callback.current(resp.credential)
          },
        })
        googleId.cancel()
        host.current.innerHTML = ''
        const width = Math.max(240, Math.floor(host.current.parentElement?.getBoundingClientRect().width || 320))
        googleId.renderButton(host.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          width,
        })
        setReady(true)
      } catch {
        setReady(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const open = async () => {
    setNativeError('')
    if (isNativeApp()) {
      try {
        const { GoogleAuth } = await import('@southdevs/capacitor-google-auth')
        await GoogleAuth.initialize({
          clientId: WEB_CLIENT_ID,
          scopes: ['profile', 'email'],
          grantOfflineAccess: false,
        })
        const user = await GoogleAuth.signIn()
        const idToken = user?.authentication?.idToken
        if (idToken) callback.current(idToken)
        else setNativeError(t.auth.googleFailed)
      } catch (err) {
        const message = String(err?.message || err || '')
        if (/cancel/i.test(message)) return
        const code = err?.code ? ` (${err.code})` : ''
        setNativeError(`${t.auth.googleFailed}${code}`)
      }
    }
  }

  return (
    <div className="google-auth">
      {ready && (
        <>
          <div className="auth-divider"><span>{t.auth.or}</span></div>
          <div className="google-signin-wrap">
            <button
              type="button"
              className="btn block google-signin-btn"
              onClick={open}
              disabled={disabled}
            >
              <GoogleMark />
              <span>{t.auth.continueGoogle}</span>
            </button>
            {!isNativeApp() && <div ref={host} className="google-btn-overlay" aria-hidden="true" />}
          </div>
          {nativeError && <div className="auth-error">{nativeError}</div>}
        </>
      )}
    </div>
  )
}
