import { useState } from 'react'
import Modal from './Modal'
import { useI18n } from '../i18n/I18nContext'

/**
 * Reusable confirmation dialog for destructive actions. Renders on top of the page
 * (or another modal) and runs `onConfirm` (which may be async) when accepted.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = true,
  onConfirm,
  onCancel,
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const cancel = () => {
    if (busy) return
    onCancel?.()
  }

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title || t.common.confirmTitle} onClose={cancel}>
      <p className="confirm-message">{message || t.common.confirmDelete}</p>
      <div className="row">
        <button type="button" className="btn secondary" onClick={cancel} disabled={busy}>
          {cancelLabel || t.common.cancel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'danger' : ''}`}
          onClick={confirm}
          disabled={busy}
        >
          {busy ? t.common.saving : confirmLabel || t.common.delete}
        </button>
      </div>
    </Modal>
  )
}
