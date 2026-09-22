import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal, ShieldCheck, Star, User } from 'lucide-react'
import { AdminApi } from '../api/client'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n/I18nContext'
import { GATEABLE_FEATURES, getRoleDefault, isFeatureVisible, ROLES } from '../features/registry'

const ROLE_META = {
  Admin:   { icon: <ShieldCheck size={20} />, color: '#7a2e2e', bg: '#7a2e2e22' },
  Premium: { icon: <Star size={20} />,        color: '#b8943e', bg: '#b8943e22' },
  User:    { icon: <User size={20} />,        color: '#0f5c4d', bg: '#0f5c4d22' },
}

/** Overrides to store: keys where the role-level state differs from the role default. */
const toOverrides = (visibleMap, role) => GATEABLE_FEATURES
  .filter((f) => getRoleDefault(f.key, role) !== !!visibleMap[f.key])
  .map((f) => f.key)

export default function AdminFeatures() {
  const { t } = useI18n()
  const toast = useToast()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  // Role-detail view state
  const [selectedRole, setSelectedRole] = useState(null)
  const [roleVisible, setRoleVisible] = useState({})   // module toggles for the whole role
  const [applyingAll, setApplyingAll] = useState(false)

  // Member list
  const [search, setSearch] = useState('')
  const [changingRole, setChangingRole] = useState(false)
  // Admin promote-user picker
  const [promoteSearch, setPromoteSearch] = useState('')
  const [promoteOpen, setPromoteOpen] = useState(false)

  useEffect(() => {
    let alive = true
    AdminApi.users({ page: 1, pageSize: 200 })
      .then((r) => { if (alive) setUsers(r.items || []) })
      .catch(() => { if (alive) setUsers([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const counts = useMemo(() => ({
    Admin:   users.filter((u) => u.role === 'Admin').length,
    Premium: users.filter((u) => u.role === 'Premium').length,
    User:    users.filter((u) => (u.role || 'User') === 'User').length,
  }), [users])

  const roleUsers = useMemo(() => {
    if (!selectedRole) return []
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => (u.role || 'User') === selectedRole)
      .filter((u) => !q || (u.fullName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
  }, [users, selectedRole, search])

  // Promote picker â€” must be declared here (before any early return) to satisfy Rules of Hooks.
  const nonAdmins = useMemo(() => users.filter((u) => (u.role || 'User') !== 'Admin'), [users])
  const filteredForPromo = useMemo(() => {
    const q = promoteSearch.trim().toLowerCase()
    if (!q) return nonAdmins
    return nonAdmins.filter((u) =>
      (u.fullName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
  }, [nonAdmins, promoteSearch])

  // Open a role: initialise role-level toggles to the role defaults.
  const openRole = (role) => {
    const map = {}
    for (const f of GATEABLE_FEATURES) map[f.key] = getRoleDefault(f.key, role)
    setRoleVisible(map)
    setSelectedRole(role)
    setSearch('')
    setExpandedId(null)
  }

  // Apply role-level config to EVERY user in the role.
  const applyToAll = async () => {
    const overrides = toOverrides(roleVisible, selectedRole)
    setApplyingAll(true)
    try {
      const targets = users.filter((u) => (u.role || 'User') === selectedRole)
      await Promise.all(targets.map((u) => AdminApi.setUserFeatures(u.id, overrides)))
      // Reflect locally.
      setUsers((prev) => prev.map((u) =>
        (u.role || 'User') === selectedRole ? { ...u, disabledFeatures: overrides } : u))
      toast.success(t.features.appliedToAll)
    } catch (err) { toast.error(err?.response?.data?.detail || err?.response?.data?.message || t.expenses.saveError)
    } finally { setApplyingAll(false) }
  }

  const changeUserRole = async (u, newRole) => {
    setChangingRole(true)
    try {
      const updated = await AdminApi.setUserRole(u.id, newRole)
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: updated.role, disabledFeatures: [] } : x))
      setExpandedId(null)
      toast.success(t.features.roleSaved)
    } catch (err) { toast.error(err?.response?.data?.detail || err?.response?.data?.message || t.expenses.saveError)
    } finally { setChangingRole(false) }
  }

  if (loading) return <div className="loading">{t.common.loading}</div>

  // â”€â”€â”€ Role picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!selectedRole) {
    return (
      <div>
        <div className="page-header">
          <h1>{t.features.title}</h1>
          <p>{t.features.subtitle}</p>
        </div>
        <div className="grid grid-3" style={{ gap: 16 }}>
          {ROLES.map((role) => {
            const m = ROLE_META[role]
            return (
              <button key={role} type="button" className="card"
                style={{ cursor: 'pointer', textAlign: 'left', border: `2px solid ${m.color}33` }}
                onClick={() => openRole(role)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span className="badge-icon" style={{ background: m.bg, color: m.color, width: 44, height: 44 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{role}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{counts[role]} {t.features.usersCount}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {role === 'Admin'   && t.features.descAdmin}
                  {role === 'Premium' && t.features.descPremium}
                  {role === 'User'    && t.features.descUser}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // â”€â”€â”€ Role detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const meta = ROLE_META[selectedRole]

  const promoteToAdmin = async (u) => {
    setChangingRole(true)
    try {
      const updated = await AdminApi.setUserRole(u.id, 'Admin')
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: updated.role } : x))
      setPromoteSearch('')
      setPromoteOpen(false)
      toast.success(`${u.fullName || u.email} â†’ Admin`)
    } catch (err) { toast.error(err?.response?.data?.detail || err?.response?.data?.message || t.expenses.saveError)
    } finally { setChangingRole(false) }
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header row" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn secondary" onClick={() => setSelectedRole(null)}>â† {t.features.allRoles}</button>
          <span className="badge-icon" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</span>
          <h1 style={{ margin: 0 }}>{selectedRole}</h1>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{counts[selectedRole]} {t.features.usersCount}</span>
        </div>
      </div>

      {/* â”€â”€ Section 1a: Admin â€” promote user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {selectedRole === 'Admin' ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>
            <ShieldCheck size={16} style={{ marginRight: 8, color: '#7a2e2e' }} />
            {t.features.promoteTitle}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>{t.features.promoteHint}</p>

          {/* Promote picker */}
          <div className="feat-user-combo" style={{ position: 'relative' }}>
            <input
              type="search"
              value={promoteSearch}
              onFocus={() => setPromoteOpen(true)}
              onBlur={() => setTimeout(() => setPromoteOpen(false), 150)}
              onChange={(e) => { setPromoteSearch(e.target.value); setPromoteOpen(true) }}
              placeholder={t.features.promoteSearch}
              autoComplete="off"
            />
            {promoteOpen && (
              <div className="feat-user-list">
                {filteredForPromo.length === 0 ? (
                  <div style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: 13 }}>{t.features.noUsers}</div>
                ) : filteredForPromo.map((u) => (
                  <button key={u.id} type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => promoteToAdmin(u)}
                    disabled={changingRole}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span className="badge-icon" style={{ background: ROLE_META[u.role || 'User'].bg, color: ROLE_META[u.role || 'User'].color, width: 28, height: 28, fontSize: 13 }}>
                      {ROLE_META[u.role || 'User'].icon}
                    </span>
                    <span>
                      {u.fullName || u.email}
                      {u.fullName && <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 12 }}>{u.email}</span>}
                      <span className="pill" style={{ marginLeft: 6, background: ROLE_META[u.role || 'User'].bg, color: ROLE_META[u.role || 'User'].color, fontSize: 11 }}>{u.role || 'User'}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* â”€â”€ Section 1b: Role-level module config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div>
              <h2 className="section-title" style={{ marginTop: 0 }}>
                <SlidersHorizontal size={16} style={{ marginRight: 8 }} />
                {t.features.rolePermissionsTitle}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{t.features.rolePermissionsHint}</p>
            </div>
            <button className="btn" onClick={applyToAll} disabled={applyingAll}>
              {applyingAll ? t.common.saving : t.features.applyToAll}
            </button>
          </div>

          <div className="insight" style={{ marginBottom: 14, fontSize: 13 }}>
            â„¹ï¸ {t.features.alwaysOn}
          </div>

          <div className="list">
            {GATEABLE_FEATURES.map((f) => {
              const isOn = !!roleVisible[f.key]
              const roleDef = getRoleDefault(f.key, selectedRole)
              const modified = isOn !== roleDef
              return (
                <label key={f.key} className="list-item" style={{ cursor: 'pointer' }}>
                  <div className="meta">
                    <div className="title">{t.nav[f.navKey]}</div>
                    <div className="sub">
                      {roleDef ? t.features.defaultOnRole : t.features.defaultOffRole}
                      {modified && <span style={{ color: '#b8943e', marginLeft: 8 }}>âœŽ {t.features.overridden}</span>}
                    </div>
                  </div>
                  <div className="list-item-end">
                    <span className={`pill ${isOn ? 'pill-auto' : 'pill-manual'}`}>{isOn ? t.features.visible : t.features.hidden}</span>
                    <input type="checkbox" checked={isOn} onChange={() => setRoleVisible((p) => ({ ...p, [f.key]: !p[f.key] }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* â”€â”€ Section 2: Members table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="card">
        <h2 className="section-title" style={{ marginTop: 0 }}>{t.features.membersTitle}</h2>

        <div className="field" style={{ marginBottom: 12 }}>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.features.searchUser} />
        </div>

          {roleUsers.length === 0 ? (
          <div className="empty">{search ? t.features.noUsers : t.features.noUsersInRole}</div>
        ) : (
          <div className="list">
            {roleUsers.map((u) => {
              // Protect the last admin: if there's only 1 admin left, don't show demote buttons.
              const isLastAdmin = selectedRole === 'Admin' && counts.Admin <= 1
              const movableTo = isLastAdmin
                ? []    // cannot demote the only admin
                : selectedRole === 'Admin'
                  ? ROLES.filter((r) => r !== 'Admin')          // demote: User or Premium
                  : ROLES.filter((r) => r !== 'Admin' && r !== selectedRole) // switch between User/Premium
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--border)' }}>
                  <span className="user-avatar" style={{ flexShrink: 0 }}>
                    {(u.fullName || u.email || '?').charAt(0).toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.fullName || u.email}</div>
                    {u.fullName && <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>}
                  </div>
                  {/* Role change buttons */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                    {isLastAdmin && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.features.lastAdmin}</span>}
                    {movableTo.map((r) => (
                      <button key={r} type="button"
                        className="btn secondary"
                        style={{ fontSize: 11, padding: '3px 10px', color: ROLE_META[r].color, borderColor: ROLE_META[r].color }}
                        disabled={changingRole}
                        onClick={() => changeUserRole(u, r)}
                      >
                        â†’ {r}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

