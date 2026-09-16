import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { AdminApi } from '../api/client'
import { useToast } from '../components/Toast'
import { useI18n } from '../i18n/I18nContext'
import { GATEABLE_FEATURES, isFeatureVisible } from '../features/registry'

export default function AdminFeatures() {
  const { t } = useI18n()
  const toast = useToast()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  // Per-module visibility for the selected user (true = the user can see it).
  const [visible, setVisible] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    AdminApi.users({ page: 1, pageSize: 200 })
      .then((res) => { if (alive) setUsers(res.items || []) })
      .catch(() => { if (alive) setUsers([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      (u.fullName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
  }, [users, search])

  const selectedUser = users.find((u) => u.id === selectedId) || null

  const selectUser = (id) => {
    setSelectedId(id)
    const u = users.find((x) => x.id === id)
    const overrides = u?.disabledFeatures || []
    const map = {}
    for (const f of GATEABLE_FEATURES) map[f.key] = isFeatureVisible(f.key, overrides)
    setVisible(map)
  }

  const toggle = (key) => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Build the stored "overrides" set: hidden opt-out modules + granted opt-in modules.
  const buildOverrides = () => GATEABLE_FEATURES
    .filter((f) => {
      const isOn = f.defaultOn !== false
      const v = !!visible[f.key]
      return isOn ? !v : v
    })
    .map((f) => f.key)

  const save = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      const updated = await AdminApi.setUserFeatures(selectedId, buildOverrides())
      // Reflect the saved state back into the local list.
      setUsers((prev) => prev.map((u) => (u.id === selectedId ? { ...u, disabledFeatures: updated.disabledFeatures } : u)))
      toast.success(t.features.saved)
    } catch (err) {
      toast.error(err?.response?.data?.message || t.expenses.saveError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">{t.common.loading}</div>

  return (
    <div>
      <div className="page-header">
        <h1>{t.features.title}</h1>
        <p>{t.features.subtitle}</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field-row">
          <div className="field" style={{ flex: 1 }}>
            <label>{t.features.searchUser}</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.features.searchUser}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{t.features.pickUser}</label>
            <select value={selectedId} onChange={(e) => selectUser(e.target.value)}>
              <option value="">{t.common.select}</option>
              {filtered.length === 0 ? (
                <option value="" disabled>{t.features.noUsers}</option>
              ) : (
                filtered.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.fullName || u.email)}{u.fullName ? ` · ${u.email}` : ''}{u.role === 'Admin' ? ' · Admin' : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {!selectedUser ? (
        <div className="empty">{t.features.loadUserHint}</div>
      ) : (
        <div className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            <span className="badge-icon" style={{ background: '#0f5c4d22', color: '#0f5c4d', marginRight: 8 }}>
              <SlidersHorizontal size={16} />
            </span>
            {selectedUser.fullName || selectedUser.email}
          </h2>
          <div className="field-hint" style={{ marginTop: 0 }}>
            {t.features.alwaysOn}{selectedUser.role === 'Admin' ? ` · ${t.features.adminHint}` : ''}
          </div>

          <div className="list" style={{ marginTop: 12 }}>
                {GATEABLE_FEATURES.map((f) => {
                  const isVisible = !!visible[f.key]
                  return (
                    <label className="list-item" key={f.key} style={{ cursor: 'pointer' }}>
                      <div className="meta">
                        <div className="title">{t.nav[f.navKey]}</div>
                        {f.defaultOn === false && (
                          <div className="sub">{t.features.optIn}</div>
                        )}
                      </div>
                      <div className="list-item-end">
                        <span className={`pill ${isVisible ? 'pill-auto' : 'pill-manual'}`}>
                          {t.features.visible}
                        </span>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggle(f.key)}
                          style={{ width: 20, height: 20, cursor: 'pointer' }}
                        />
                      </div>
                    </label>
                  )
                })}
          </div>

          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={save} disabled={saving}>
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
