import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { useAuth } from '../auth/AuthContext'
import { CreditsApi } from '../api/client'
import { formatDate } from '../utils/format'
import LanguageSwitcher from './LanguageSwitcher'

const POLL_MS = 5 * 60 * 1000

export default function Layout() {
  const { t } = useI18n()
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const [alerts, setAlerts] = useState(null)
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef(null)

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

  const links = [
    { to: '/', label: t.nav.summary, icon: '📊', end: true },
    { to: '/categories', label: t.nav.categories, icon: '🏷️' },
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
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">💰</span>
          <span>{t.appName}</span>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="ic">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </aside>
      <main className="content">
        <div className="topbar">
          <LanguageSwitcher />
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
            <div className="user-menu">
              <span className="user-avatar">{initial}</span>
              <span className="user-name">{displayName}</span>
              <button className="btn secondary" onClick={onLogout}>{t.auth.logout}</button>
            </div>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
