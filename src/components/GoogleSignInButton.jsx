import { useEffect, useRef, useState } from 'react'
import { AuthApi } from '../api/client'
import { useI18n } from '../i18n/I18nContext'

const GIS = 'https://accounts.google.com/gsi/client'

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

export default function GoogleSignInButton({ onCredential, disabled }) {
  const { t } = useI18n()
  const host = useRef(null)
  const callback = useRef(onCredential)
  callback.current = onCredential
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const config = await AuthApi.googleClient()
        if (!config?.clientId || cancelled) return
        await loadGis()
        if (cancelled || !host.current) return
        const width = Math.max(240, Math.floor(host.current.getBoundingClientRect().width) || 320)
        window.google.accounts.id.initialize({
          client_id: config.clientId,
          callback: (resp) => {
            if (resp?.credential) callback.current(resp.credential)
          },
        })
        host.current.innerHTML = ''
        window.google.accounts.id.renderButton(host.current, {
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

  return (
    <div className="google-auth">
      {ready && <div className="auth-divider"><span>{t.auth.or}</span></div>}
      <div ref={host} className="google-btn-host" style={{ display: ready ? 'flex' : 'none' }} />
    </div>
  )
}
