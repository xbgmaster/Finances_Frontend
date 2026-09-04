import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { countryLabel, findCountry, searchCountries } from '../utils/countries'

export default function CountrySelect({ value, onChange, required = false, id }) {
  const { t, language } = useI18n()
  const selected = findCountry(value)
  const [query, setQuery] = useState(() => (selected ? countryLabel(selected, language) : value || ''))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    const match = findCountry(value)
    setQuery(match ? countryLabel(match, language) : value || '')
  }, [value, language])

  const options = useMemo(() => searchCountries(query, language), [query, language])

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        const match = findCountry(value)
        setQuery(match ? countryLabel(match, language) : value || '')
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open, value, language])

  useEffect(() => {
    setActive(0)
  }, [query, open])

  const pick = (country) => {
    onChange(country)
    setQuery(countryLabel(country, language))
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(0, options.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && open && options[active]) {
      e.preventDefault()
      pick(options[active])
    }
  }

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  return (
    <div className="country-select" ref={rootRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="country-name"
        aria-expanded={open}
        aria-controls="country-select-list"
        aria-autocomplete="list"
        required={required}
        placeholder={t.common.countryPlaceholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange(null)
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id="country-select-list" className="country-select-list" role="listbox" ref={listRef}>
          {options.length === 0 ? (
            <li className="country-select-empty">{t.common.countryEmpty}</li>
          ) : (
            options.map((c, i) => (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.code === c.code}
                  data-active={i === active}
                  className={`country-select-option ${i === active ? 'is-active' : ''} ${selected?.code === c.code ? 'is-selected' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c)}
                >
                  <span>{c.label}</span>
                  <span className="country-select-ccy">{c.currency}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
