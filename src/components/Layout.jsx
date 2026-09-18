import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CreditCard, TrendingDown, Landmark, CalendarDays,
  Sparkles, ShieldCheck, Tag, Settings, LogOut, Briefcase, Users, SlidersHorizontal, ChevronDown,
  HelpCircle,
} from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useAuth } from '../auth/AuthContext'
import { CreditsApi } from '../api/client'
import { formatDate } from '../utils/format'
import LanguageSwitcher from './LanguageSwitcher'
import CurrencySwitcher from './CurrencySwitcher'
import ThemeSwitcher from './ThemeSwitcher'
import BrandLogo from './BrandLogo'
import { useTheme } from '../theme/ThemeContext'
import { startTour, isTourPending, markTourPending as _mark } from '../tour/useTour'

// Heavy WebGL/ogl effect: load it only once the authenticated app shell renders.
const MoltenMetal = lazy(() => import('./MoltenMetal'))

const POLL_MS = 5 * 60 * 1000

export default function Layout() {
  const { t } = useI18n()
  const { theme } = useTheme()
  const { user, isAdmin, canAccess, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [alerts, setAlerts] = useState(null)
  const [bellOpen, setBellOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(
    () => location.pathname.startsWith('/admin') || location.pathname === '/payroll',
  )
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

  // Auto-start the tour when the user first arrives after onboarding.
  useEffect(() => {
    if (isTourPending()) {
      // Small delay so nav elements are painted before driver.js measures them.
      const tid = setTimeout(() => startTour(t), 600)
      return () => clearTimeout(tid)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    { to: '/', label: t.nav.summary, icon: <LayoutDashboard size={18} />, end: true, tour: 'nav-summary' },
    { to: '/cards', label: t.nav.cards, icon: <CreditCard size={18} />, feature: 'cards', tour: 'nav-cards' },
    { to: '/expenses', label: t.nav.expenses, icon: <TrendingDown size={18} />, feature: 'expenses', tour: 'nav-expenses' },
    { to: '/credits', label: t.nav.credits, icon: <Landmark size={18} />, feature: 'credits', tour: 'nav-credits' },
    { to: '/budget-history', label: t.nav.budgetHistory, icon: <CalendarDays size={18} />, feature: 'budget', tour: 'nav-budget' },
    { to: '/projections', label: t.nav.projections, icon: <Sparkles size={18} />, feature: 'projections', tour: 'nav-projections' },
    // Jobs & pay is opt-in: shown here only to non-admins who were granted access
    // (admins always have it, listed inside the Administration submenu instead).
    { to: '/payroll', label: t.nav.payroll, icon: <Briefcase size={18} />, feature: 'payroll', adminHidden: true },
  ].filter((l) => (!l.feature || canAccess(l.feature)) && !(l.adminHidden && isAdmin))

  // All admin-only options live together under a collapsible "Administration" group.
  const adminLinks = isAdmin ? [
    { to: '/admin', label: t.nav.users, icon: <Users size={18} />, end: true },
    { to: '/admin/features', label: t.nav.featureAccess, icon: <SlidersHorizontal size={18} /> },
    { to: '/payroll', label: t.nav.payroll, icon: <Briefcase size={18} /> },
  ] : []

  const onLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const displayName = user?.fullName || user?.email || ''
  const initial = (displayName || '?').charAt(0).toUpperCase()

  const cardAlertCount = alerts?.cardAlertCount ?? 0
  const count = (alerts?.overdueCount ?? 0) + (alerts?.dueSoonCount ?? 0) + cardAlertCount
  const hasOverdue = (alerts?.overdueCount ?? 0) > 0 || (alerts?.cardAlerts ?? []).some((a) => a.alertType === 'OverLimit')

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
    <>
      <div className="app-molten-bg" aria-hidden="true">
        <Suspense fallback={null}>
          <MoltenMetal
            color1={theme === 'dark' ? '#0e2a24' : '#D7E4DC'}
            color2={theme === 'dark' ? '#8a6b22' : '#D4B05A'}
            color3={theme === 'dark' ? '#0a1512' : '#FFF8EE'}
            colorMode="molten"
            speed={0.32}
            scale={4}
            detail={3}
            glow={theme === 'dark' ? 1.3 : 1.55}
            coreSize={0.12}
            swirl={0.95}
            fold={-0.18}
            blackPoint={0.04}
            brightness={theme === 'dark' ? 1.0 : 1.28}
            opacity={theme === 'dark' ? 0.4 : 0.52}
            grain
            grainIntensity={0.035}
            mouseInteraction
            mouseStrength={0.22}
          />
        </Suspense>
      </div>
      <div className="app">
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
        <nav className="sidebar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              data-tour={l.tour}
            >
              <span className="ic">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}

          {isAdmin && (
            <div className="nav-group">
              <button
                type="button"
                className="nav-link nav-group-toggle"
                onClick={() => setAdminOpen((o) => !o)}
                aria-expanded={adminOpen}
              >
                <span className="ic"><ShieldCheck size={18} /></span>
                {t.nav.admin}
                <ChevronDown size={16} className={`nav-caret ${adminOpen ? 'open' : ''}`} />
              </button>
              {adminOpen && (
                <div className="nav-subgroup">
                  {adminLinks.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      end={l.end}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                    >
                      <span className="ic">{l.icon}</span>
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="tour-help-btn"
            data-tour="help-btn"
            onClick={() => { setMenuOpen(false); setTimeout(() => startTour(t, location.pathname), 50) }}
          >
            <HelpCircle size={16} /> {t.tour.helpTitle}
          </button>
          <span className="sidebar-footer-label">{t.common.theme}</span>
          <ThemeSwitcher />
        </div>
        <div className="sidebar-account">
          <NavLink
            to="/categories"
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="ic"><Tag size={18} /></span>
            {t.nav.categories}
          </NavLink>
          <NavLink
            to="/settings"
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="ic"><Settings size={18} /></span>
            {t.settings.menuItem}
          </NavLink>
          <button
            type="button"
            className="nav-link nav-link-logout"
            onClick={onLogout}
          >
            <span className="ic"><LogOut size={18} /></span>
            {t.auth.logout}
          </button>
        </div>
      </aside>
      <main className="content">
        <div className="topbar">
          <div className="topbar-left">
            <LanguageSwitcher />
            <span data-tour="currency-lens">
              <CurrencySwitcher />
            </span>
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
                        {(alerts.cardAlerts ?? []).map((c, i) => (
                          <button key={`ca-${i}`} className="bell-item" onClick={() => { setBellOpen(false); navigate('/cards') }}>
                            <span className={`bell-dot ${c.alertType === 'OverLimit' ? 'over' : 'soon'}`} />
                            <span className="bell-item-body">
                              <span className="bell-item-title">{c.name}</span>
                              <span className="bell-item-sub">
                                {c.alertType === 'OverLimit'
                                  ? `${t.notifications.overLimit} ${c.overByAmount} ${c.currency}`
                                  : c.alertType === 'StatementSoon'
                                    ? `${t.notifications.statementIn} ${c.daysUntilDate}d`
                                    : `${t.notifications.paymentDueIn} ${c.daysUntilDate}d`}
                              </span>
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
                    <span className="ic"><Settings size={16} /></span> {t.settings.menuItem}
                  </button>
                  <button className="user-dd-item danger" role="menuitem" onClick={onLogout}>
                    <span className="ic"><LogOut size={16} /></span> {t.auth.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <Outlet />
      </main>
      </div>
    </>
  )
}
