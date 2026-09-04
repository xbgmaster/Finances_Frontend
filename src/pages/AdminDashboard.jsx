import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { AdminApi } from '../api/client'
import StatCard from '../components/StatCard'
import { formatDate } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'

const ACTIVE_DAYS = 30

function loginStatus(user, t) {
  if (!user.lastLoginAt) return { key: 'never', label: t.admin.statusNever, pill: 'pill-muted' }
  const days = (Date.now() - new Date(user.lastLoginAt).getTime()) / 86_400_000
  if (days > ACTIVE_DAYS) return { key: 'inactive', label: t.admin.statusInactive, pill: 'pill-due' }
  return { key: 'active', label: t.admin.statusActive, pill: 'pill-user' }
}

export default function AdminDashboard() {
  const { t } = useI18n()
  const [stats, setStats] = useState(null)
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState({ search: '', role: '', status: '', page: 1 })
  const [loading, setLoading] = useState(true)
  const pageSize = 10

  useEffect(() => {
    AdminApi.stats().then(setStats)
  }, [])

  useEffect(() => {
    setLoading(true)
    const handler = setTimeout(() => {
      AdminApi.users({
        search: filters.search || undefined,
        role: filters.role || undefined,
        status: filters.status || undefined,
        page: filters.page,
        pageSize,
      })
        .then(setData)
        .finally(() => setLoading(false))
    }, 350)
    return () => clearTimeout(handler)
  }, [filters])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

  const chartData = useMemo(
    () => (stats?.signupsByMonth || []).map((s) => ({
      name: `${t.months[s.month - 1].slice(0, 3)} ${String(s.year).slice(2)}`,
      [t.admin.signups]: s.count,
    })),
    [stats, t],
  )

  const exportCsv = async () => {
    const blob = await AdminApi.exportCsv({
      search: filters.search || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const setSearch = (search) => setFilters((f) => ({ ...f, search, page: 1 }))
  const setRole = (role) => setFilters((f) => ({ ...f, role, page: 1 }))
  const setStatus = (status) => setFilters((f) => ({ ...f, status, page: 1 }))
  const setPage = (page) => setFilters((f) => ({ ...f, page }))
  const toggleStatus = (status) => setStatus(filters.status === status ? '' : status)

  return (
    <div>
      <div className="page-header">
        <h1>{t.admin.title}</h1>
        <p>{t.admin.subtitle}</p>
      </div>

      {stats && (
        <>
          <div className="grid grid-4">
            <StatCard label={t.admin.totalUsers} value={stats.totalUsers} icon="👥" color="#0f5c4d" isMoney={false} />
            <button type="button" className="stat-as-btn" onClick={() => toggleStatus('Active')}>
              <StatCard label={t.admin.activeUsers} value={stats.activeUsers} icon="✅" color="#10b981" isMoney={false} hint={t.admin.activeUsersHint} />
            </button>
            <StatCard label={t.admin.newThisMonth} value={stats.newUsersThisMonth} icon="🆕" color="#f59e0b" isMoney={false} />
            <StatCard label={t.admin.admins} value={stats.adminUsers} icon="🛡️" color="#7a2e2e" isMoney={false} />
          </div>

          <div className="grid grid-4" style={{ marginTop: 20 }}>
            <button type="button" className="stat-as-btn" onClick={() => toggleStatus('Never')}>
              <StatCard label={t.admin.neverLoggedIn} value={stats.neverLoggedIn} icon="🚪" color="#5c6b73" isMoney={false} hint={t.admin.neverLoggedInHint} />
            </button>
            <button type="button" className="stat-as-btn" onClick={() => toggleStatus('Inactive')}>
              <StatCard label={t.admin.inactiveUsers} value={stats.inactiveUsers} icon="😴" color="#b45309" isMoney={false} hint={t.admin.inactiveUsersHint} />
            </button>
            <button type="button" className="stat-as-btn" onClick={() => toggleStatus('Pending')}>
              <StatCard label={t.admin.pendingOnboarding} value={stats.pendingOnboarding} icon="🪄" color="#b8943e" isMoney={false} hint={t.admin.pendingOnboardingHint} />
            </button>
            <StatCard
              label={t.admin.usersWithActivity}
              value={stats.usersWithActivity}
              icon="📌"
              color="#0f5c4d"
              isMoney={false}
              hint={t.admin.usersWithActivityHint}
            />
          </div>

          <h2 className="section-title">{t.admin.signupsByMonth}</h2>
          <div className="card">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd2" />
                <XAxis dataKey="name" stroke="#66757a" fontSize={12} />
                <YAxis stroke="#66757a" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e4ddd2', borderRadius: 12, color: '#1a2b33' }} />
                <Bar dataKey={t.admin.signups} fill="#0f5c4d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="admin-users-head">
        <h2 className="section-title" style={{ margin: 0 }}>{t.admin.usersTitle}</h2>
        <div className="filter-bar">
          <input
            type="text"
            placeholder={t.admin.search}
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filters.role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t.admin.allRoles}</option>
            <option value="Admin">{t.admin.roleAdmin}</option>
            <option value="User">{t.admin.roleUser}</option>
          </select>
          <select value={filters.status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t.admin.allStatus}</option>
            <option value="Active">{t.admin.statusActive}</option>
            <option value="Inactive">{t.admin.statusInactive}</option>
            <option value="Never">{t.admin.statusNever}</option>
            <option value="Pending">{t.admin.statusPending}</option>
            <option value="NoActivity">{t.admin.statusNoActivity}</option>
          </select>
          <button className="btn" onClick={exportCsv}>⬇ {t.admin.exportCsv}</button>
        </div>
      </div>

      <div className="card table-card">
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.admin.colUser}</th>
              <th>{t.admin.colRole}</th>
              <th>{t.admin.colStatus}</th>
              <th>{t.admin.colOnboarding}</th>
              <th>{t.admin.colCountry}</th>
              <th>{t.admin.colCreated}</th>
              <th>{t.admin.colLastLogin}</th>
              <th className="num">{t.admin.colActivity}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="loading">{t.common.loading}</td></tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr><td colSpan={8} className="loading">{t.admin.noUsers}</td></tr>
            )}
            {!loading && data?.items.map((u) => {
              const status = loginStatus(u, t)
              return (
                <tr key={u.id}>
                  <td>
                    <div className="title">{u.fullName || '—'}</div>
                    <div className="sub">{u.email}</div>
                  </td>
                  <td>
                    <span className={`pill ${u.role === 'Admin' ? 'pill-admin' : 'pill-user'}`}>
                      {u.role === 'Admin' ? t.admin.roleAdmin : t.admin.roleUser}
                    </span>
                  </td>
                  <td>
                    <span className={`pill ${status.pill}`}>{status.label}</span>
                  </td>
                  <td>
                    <span className={`pill ${u.onboardingCompleted ? 'pill-user' : 'pill-due'}`}>
                      {u.onboardingCompleted ? t.admin.onboardingDone : t.admin.onboardingPending}
                    </span>
                  </td>
                  <td>{u.country || '—'}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : t.admin.neverLoggedInShort}</td>
                  <td className="num">{u.expenseCount}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {data && (
        <div className="row" style={{ marginTop: 16, justifyContent: 'center', gap: 16 }}>
          <button className="btn secondary" disabled={filters.page <= 1} onClick={() => setPage(filters.page - 1)}>
            {t.admin.prev}
          </button>
          <span className="hint">{t.admin.page} {filters.page} / {totalPages}</span>
          <button className="btn secondary" disabled={filters.page >= totalPages} onClick={() => setPage(filters.page + 1)}>
            {t.admin.next}
          </button>
        </div>
      )}
    </div>
  )
}
