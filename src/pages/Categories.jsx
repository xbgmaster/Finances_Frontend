import { useEffect, useState } from 'react'
import { CategoriesApi } from '../api/client'
import Modal from '../components/Modal'
import { ICON_KEYS, iconFor, COLOR_PALETTE } from '../utils/icons'
import { formatMoney } from '../utils/format'
import { useI18n } from '../i18n/I18nContext'

const emptyForm = { name: '', icon: 'tag', color: '#6366f1', monthlyBudget: '' }

export default function Categories() {
  const { t } = useI18n()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setCategories(await CategoriesApi.list())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({ name: c.name, icon: c.icon, color: c.color, monthlyBudget: c.monthlyBudget ?? '' })
    setError('')
    setShowModal(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const payload = {
      name: form.name.trim(),
      icon: form.icon,
      color: form.color,
      monthlyBudget: form.monthlyBudget === '' ? null : parseFloat(form.monthlyBudget),
    }
    if (editing) await CategoriesApi.update(editing.id, payload)
    else await CategoriesApi.create(payload)
    setShowModal(false)
    await load()
  }

  const remove = async (c) => {
    setError('')
    try {
      await CategoriesApi.remove(c.id)
      await load()
    } catch (err) {
      setError(err?.response?.data?.message || t.categories.deleteError)
    }
  }

  if (loading) return <div className="loading">{t.common.loading}</div>

  return (
    <div>
      <div className="page-header row">
        <div>
          <h1>{t.categories.title}</h1>
          <p>{t.categories.subtitle}</p>
        </div>
        <button className="btn" onClick={openCreate}>{t.categories.newCategory}</button>
      </div>

      {error && <div className="insight" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>{error}</div>}

      <div className="grid grid-3">
        {categories.map((c) => (
          <div className="card" key={c.id}>
            <div className="row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="badge-icon" style={{ background: `${c.color}22`, color: c.color }}>
                  {iconFor(c.icon)}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div className="hint" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {c.monthlyBudget != null ? `${t.categories.budget}: ${formatMoney(c.monthlyBudget)}` : t.categories.noBudget}
                  </div>
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn secondary" onClick={() => openEdit(c)}>{t.common.edit}</button>
              <button className="btn danger" onClick={() => remove(c)}>{t.common.delete}</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title={editing ? t.categories.editTitle : t.categories.newTitle} onClose={() => setShowModal(false)}>
          <form onSubmit={submit}>
            <div className="field">
              <label>{t.categories.name}</label>
              <input
                type="text" autoFocus required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.categories.namePlaceholder}
              />
            </div>

            <div className="field">
              <label>{t.categories.icon}</label>
              <div className="icon-grid">
                {ICON_KEYS.map((key) => (
                  <button
                    type="button"
                    key={key}
                    className={`icon-pick ${form.icon === key ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, icon: key })}
                  >
                    {iconFor(key)}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>{t.categories.color}</label>
              <div className="color-grid">
                {COLOR_PALETTE.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={`color-pick ${form.color === color ? 'active' : ''}`}
                    style={{ background: color }}
                    onClick={() => setForm({ ...form, color })}
                  />
                ))}
              </div>
            </div>

            <div className="field">
              <label>{t.categories.monthlyBudget}</label>
              <input
                type="number" step="0.01" min="0"
                value={form.monthlyBudget}
                onChange={(e) => setForm({ ...form, monthlyBudget: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>{t.common.cancel}</button>
              <button type="submit" className="btn">{editing ? t.common.saveChanges : t.common.create}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
