import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { useAuth } from '../auth/AuthContext'
import { CreditsApi } from '../api/client'
import { formatDate } from '../utils/format'
import LanguageSwitcher from './LanguageSwitcher'
import CurrencySwitcher from './CurrencySwitcher'
import BrandLogo from './BrandLogo'

// Heavy WebGL/ogl effect: load it only once the authenticated app shell renders.
const MoltenMetal = lazy(() => import('./MoltenMetal'))

const POLL_MS = 5 * 60 * 1000

export default function Layout() {
  const { t } = useI18n()
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [alerts, setAlerts] = useState(null)
  const [bellOpen, setBellOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const bellRef = useRef(null)
  const userRef = useRef(null)

  const loadAlerts = async () => {
    try {
      setAlerts(await CreditsApi.alerts())
    } catch {
      // Silent: the bell is non-critical. Keep the previous state.
    }
  }

  useEffect(() => {
    loadAlerts()
    const id = setInterval(loadAlerts, POLL_MS)
    return () => clearInterval(id)
  }, [])

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!bellOpen) return
    const onClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [bellOpen])

  // Close the user menu when clicking outside it.
  useEffect(() => {
    if (!userOpen) return
    const onClick = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [userOpen])

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const links = [
    { to: '/', label: t.nav.summary, icon: '📊', end: true },
    { to: '/cards', label: t.nav.cards, icon: '💳' },
    { to: '/expenses', label: t.nav.expenses, icon: '💸' },
    { to: '/credits', label: t.nav.credits, icon: '🏦' },
    { to: '/budget-history', label: t.nav.budgetHistory, icon: '📅' },
    { to: '/projections', label: t.nav.projections, icon: '🤖' },
  ]
  if (isAdmin) links.push({ to: '/admin', label: t.nav.admin, icon: '🛡️' })

  const onLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const displayName = user?.fullName || user?.email || ''
  const initial = (displayName || '?').charAt(0).toUpperCase()

  const count = (alerts?.overdueCount ?? 0) + (alerts?.dueSoonCount ?? 0)
  const hasOverdue = (alerts?.overdueCount ?? 0) > 0

  const openCredit = (id) => {
    setBellOpen(false)
    navigate(`/credits/${id}`)
  }

  const itemSub = (a) => {
    if (a.alertLevel === 'Overdue') return t.notifications.overdueOn.replace('{date}', formatDate(a.nextDueDate))
    if (a.daysUntilDue === 0) return t.notifications.dueToday
    return t.notifications.dueOn.replace('{date}', formatDate(a.nextDueDate))
  }

  return (
    <div className="app">
      <div className="app-molten-bg" aria-hidden="true">
        <Suspense fallback={null}>
          <MoltenMetal
            color1="#D7E4DC"
            color2="#D4B05A"
            color3="#FFF8EE"
            colorMode="molten"
            speed={0.32}
            scale={4}
            detail={3}
            glow={1.55}
            coreSize={0.12}
            swirl={0.95}
            fold={-0.18}
            blackPoint={0.04}
            brightness={1.28}
            opacity={0.52}
            grain
            grainIntensity={0.035}
            mouseInteraction
            mouseStrength={0.22}
          />
        </Suspense>
      </div>
      <header className="mobile-header">
        <button
          className="hamburger"
          onClick={() => setMenuOpen(true)}
          aria-label={t.nav.menu}
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>
        <div className="brand brand-mobile">
          <BrandLogo className="logo" size={34} />
          <span>{t.appName}</span>
        </div>
      </header>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <BrandLogo className="logo" size={38} />
          <span>{t.appName}</span>
          <button
            className="sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label={t.common.close}
          >
            ✕
          </button>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="ic">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </aside>
      <main className="content">
        <div className="topbar">
          <div className="topbar-left">
            <LanguageSwitcher />
            <CurrencySwitcher />
          </div>
          <div className="topbar-right">
            <div className="bell-wrap" ref={bellRef}>
              <button
                className="bell-btn"
                onClick={() => setBellOpen((o) => !o)}
                aria-label={t.notifications.title}
              >
                🔔
                {count > 0 && (
                  <span className={`bell-badge ${hasOverdue ? 'over' : 'soon'}`}>{count}</span>
                )}
              </button>
              {bellOpen && (
                <div className="bell-dropdown">
                  <div className="bell-head">{t.notifications.title}</div>
                  {count === 0 ? (
                    <div className="bell-empty">{t.notifications.empty}</div>
                  ) : (
                    <>
                      <div className="bell-list">
                        {alerts.items.map((a) => (
                          <button key={a.creditId} className="bell-item" onClick={() => openCredit(a.creditId)}>
                            <span className={`bell-dot ${a.alertLevel === 'Overdue' ? 'over' : 'soon'}`} />
                            <span className="bell-item-body">
                              <span className="bell-item-title">{a.name}</span>
                              <span className="bell-item-sub">{itemSub(a)}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                      <button className="bell-foot" onClick={() => { setBellOpen(false); navigate('/credits') }}>
                        {t.notifications.viewCredits}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="user-wrap" ref={userRef}>
              <button
                className="user-menu"
                onClick={() => setUserOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={userOpen}
              >
                <span className="user-avatar">{initial}</span>
                <span className="user-name">{displayName}</span>
                <span className="user-caret">▾</span>
              </button>
              {userOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="user-dd-head">
                    <span className="user-avatar lg">{initial}</span>
                    <div className="user-dd-info">
                      <span className="user-dd-name">{displayName}</span>
                      {user?.email && <span className="user-dd-email">{user.email}</span>}
                    </div>
                  </div>
                  <button
                    className="user-dd-item"
                    role="menuitem"
                    onClick={() => { setUserOpen(false); navigate('/categories') }}
                  >
                    <span className="ic">🏷️</span> {t.nav.categories}
                  </button>
                  <button
                    className="user-dd-item"
                    role="menuitem"
                    onClick={() => { setUserOpen(false); navigate('/settings') }}
                  >
                    <span className="ic">⚙️</span> {t.settings.menuItem}
                  </button>
                  <button className="user-dd-item danger" role="menuitem" onClick={onLogout}>
                    <span className="ic">🚪</span> {t.auth.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
