import { useState } from 'react'
import { formatAmount, parseAmount } from '../utils/format'

// Shows a money amount with the thousands and decimal separators of `currency`.
// `value` stays a plain number string ("1000.5") for the form and the API.
export default function AmountInput({ value, onChange, currency, ...rest }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const shown = focused
    ? draft
    : (value === '' || value == null ? '' : formatAmount(value, currency))

  return (
    <input
      {...rest}
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onFocus={() => {
        setFocused(true)
        setDraft(value === '' || value == null ? '' : formatAmount(value, currency))
      }}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        if (raw.trim() === '') {
          onChange('')
          return
        }
        const n = parseAmount(raw, currency)
        if (!Number.isNaN(n)) onChange(String(n))
      }}
      onBlur={() => setFocused(false)}
    />
  )
}
