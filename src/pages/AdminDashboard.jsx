import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { AdminApi } from '../api/client'
import StatCard from '../components/StatCard'
import { formatMoney, formatDate } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'

export default function AdminDashboard() {
  const { t } = useI18n()
  const [stats, setStats] = useState(null)
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState({ search: '', role: '', page: 1 })
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
    const blob = await AdminApi.exportCsv({ search: filters.search || undefined, role: filters.role || undefined })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const setSearch = (search) => setFilters((f) => ({ ...f, search, page: 1 }))
  const setRole = (role) => setFilters((f) => ({ ...f, role, page: 1 }))
  const setPage = (page) => setFilters((f) => ({ ...f, page }))

  return (
    <div>
      <div className="page-header">
        <h1>{t.admin.title}</h1>
        <p>{t.admin.subtitle}</p>
      </div>

      {stats && (
        <>
          <div className="grid grid-4">
            <StatCard label={t.admin.totalUsers} value={stats.totalUsers} icon="👥" color="#6366f1" isMoney={false} />
            <StatCard label={t.admin.activeUsers} value={stats.activeUsers} icon="✅" color="#10b981" isMoney={false} />
            <StatCard label={t.admin.newThisMonth} value={stats.newUsersThisMonth} icon="🆕" color="#f59e0b" isMoney={false} />
            <StatCard label={t.admin.admins} value={stats.adminUsers} icon="🛡️" color="#ec4899" isMoney={false} />
          </div>

          <div className="grid grid-3" style={{ marginTop: 20 }}>
            <StatCard label={t.admin.totalIncome} value={stats.totalIncome} icon="📈" color="#10b981" />
            <StatCard label={t.admin.totalExpense} value={stats.totalExpense} icon="📉" color="#ef4444" />
            <StatCard label={t.expenses.expenseDetails} value={stats.totalExpenses} icon="🧾" color="#22d3ee" isMoney={false} />
          </div>

          <h2 className="section-title">{t.admin.signupsByMonth}</h2>
          <div className="card">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#283251" />
                <XAxis dataKey="name" stroke="#94a3c4" fontSize={12} />
                <YAxis stroke="#94a3c4" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #283251', borderRadius: 12 }} />
                <Bar dataKey={t.admin.signups} fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 28, marginBottom: 16 }}>
        <h2 className="section-title" style={{ margin: 0 }}>{t.admin.usersTitle}</h2>
        <div className="toolbar">
          <input
            type="text"
            placeholder={t.admin.search}
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <select value={filters.role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t.admin.allRoles}</option>
            <option value="Admin">{t.admin.roleAdmin}</option>
            <option value="User">{t.admin.roleUser}</option>
          </select>
          <button className="btn" onClick={exportCsv}>⬇ {t.admin.exportCsv}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.admin.colUser}</th>
              <th>{t.admin.colRole}</th>
              <th>{t.admin.colCountry}</th>
              <th>{t.admin.colCreated}</th>
              <th className="num">{t.admin.colIncome}</th>
              <th className="num">{t.admin.colExpense}</th>
              <th className="num">{t.admin.colBalance}</th>
              <th className="num">{t.admin.colExpenses}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="loading">{t.common.loading}</td></tr>
            )}
            {!loading && data?.items.length === 0 && (
              <tr><td colSpan={8} className="loading">{t.admin.noUsers}</td></tr>
            )}
            {!loading && data?.items.map((u) => (
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
                <td>{u.country || '—'}</td>
                <td>{formatDate(u.createdAt)}</td>
                <td className="num pos">{formatMoney(u.totalIncome)}</td>
                <td className="num neg">{formatMoney(u.totalExpense)}</td>
                <td className="num">{formatMoney(u.balance)}</td>
                <td className="num">{u.expenseCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
