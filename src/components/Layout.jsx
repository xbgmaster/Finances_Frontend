import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { useAuth } from '../auth/AuthContext'
import LanguageSwitcher from './LanguageSwitcher'

export default function Layout() {
  const { t } = useI18n()
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const links = [
    { to: '/', label: t.nav.summary, icon: '📊', end: true },
    { to: '/categorias', label: t.nav.categories, icon: '🏷️' },
    { to: '/gastos', label: t.nav.expenses, icon: '💸' },
    { to: '/proyecciones', label: t.nav.projections, icon: '🤖' },
  ]
  if (isAdmin) links.push({ to: '/admin', label: t.nav.admin, icon: '🛡️' })

  const onLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const displayName = user?.fullName || user?.email || ''
  const initial = (displayName || '?').charAt(0).toUpperCase()

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
          <div className="user-menu">
            <span className="user-avatar">{initial}</span>
            <span className="user-name">{displayName}</span>
            <button className="btn secondary" onClick={onLogout}>{t.auth.logout}</button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
