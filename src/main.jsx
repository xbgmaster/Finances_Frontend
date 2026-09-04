import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { CurrencyProvider } from './currency/CurrencyContext.jsx'
import { initNativeShell } from './native.js'
import './index.css'

const Router = import.meta.env.VITE_NATIVE === 'true' ? HashRouter : BrowserRouter

initNativeShell()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <Router>
        <AuthProvider>
          <CurrencyProvider>
            <App />
          </CurrencyProvider>
        </AuthProvider>
      </Router>
    </I18nProvider>
  </StrictMode>,
)
