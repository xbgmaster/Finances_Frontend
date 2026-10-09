const NONCE_KEY = 'tishe.googleNonce'
const TOKEN_KEY = 'tishe.googleIdToken'
const WEB_CLIENT_ID = '487523170626-r9hgc3ocogoiuthbv9tbdinnhln7n23p.apps.googleusercontent.com'

// iPhone "Add to Home Screen" runs outside Safari. Google's popup never
// returns the token there, so that mode uses a full-page redirect instead.
export function isHomeScreenApp() {
  return window.navigator.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
}

export function startGoogleHomeScreenSignIn() {
  const nonce = crypto.randomUUID()
  localStorage.setItem(NONCE_KEY, nonce)
  const redirectUri = `${window.location.origin}/`
  const params = new URLSearchParams({
    client_id: WEB_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    prompt: 'select_account',
  })
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

// Call once, before React Router moves the page. Keeps the token Google
// puts in the URL hash so the login page can finish signing in.
export function stashGoogleRedirect() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  if (!hash.includes('id_token=') && !hash.includes('error=')) return
  const params = new URLSearchParams(hash)
  const idToken = params.get('id_token')
  const error = params.get('error')
  if (idToken) sessionStorage.setItem(TOKEN_KEY, idToken)
  if (error) sessionStorage.setItem('tishe.googleError', error)
  const nonce = localStorage.getItem(NONCE_KEY)
  localStorage.removeItem(NONCE_KEY)
  if (nonce) sessionStorage.setItem(NONCE_KEY, nonce)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

export function takeGoogleRedirect() {
  const idToken = sessionStorage.getItem(TOKEN_KEY)
  const error = sessionStorage.getItem('tishe.googleError')
  const nonce = sessionStorage.getItem(NONCE_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem('tishe.googleError')
  sessionStorage.removeItem(NONCE_KEY)
  if (!idToken && !error) return null
  if (idToken && nonce && !tokenNonceMatches(idToken, nonce)) {
    return { error: 'nonce' }
  }
  return { idToken, error }
}

function tokenNonceMatches(idToken, nonce) {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.nonce === nonce
  } catch {
    return false
  }
}
