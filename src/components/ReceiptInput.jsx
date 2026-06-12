import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'

// Selector de imagen con vista previa para adjuntar el recibo/factura.
export default function ReceiptInput({ file, onChange }) {
  const { t } = useI18n()
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const pick = (e) => {
    const f = e.target.files?.[0]
    if (f) onChange(f)
  }

  const clear = () => {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="receipt-input">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={pick}
        style={{ display: 'none' }}
      />
      {preview ? (
        <div className="receipt-preview">
          <img src={preview} alt="receipt preview" />
          <button type="button" className="btn danger" onClick={clear}>{t.common.remove}</button>
        </div>
      ) : (
        <button type="button" className="btn secondary block" onClick={() => inputRef.current?.click()}>
          🧾 {t.common.chooseImage}
        </button>
      )}
    </div>
  )
}
