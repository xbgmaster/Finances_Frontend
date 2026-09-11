import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let seq = 0

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((type, message, opts = {}) => {
    if (!message) return null
    const id = ++seq
    setToasts((list) => [...list, { id, type, message }])
    const duration = opts.duration ?? 4000
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    success: (message, opts) => push('success', message, opts),
    error: (message, opts) => push('error', message, opts),
    info: (message, opts) => push('info', message, opts),
    dismiss,
  }), [push, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div key={t.id} className={`toast toast-${t.type}`} role="status">
              <span className="toast-icon"><Icon size={18} /></span>
              <span className="toast-msg">{t.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
