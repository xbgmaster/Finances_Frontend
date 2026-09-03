export function tintVars(hex) {
  return { '--tint': hex || '#0f5c4d' }
}

export function normalizeHex(value, fallback = '#0f5c4d') {
  const raw = String(value || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`
  return fallback
}

export function sameColor(a, b) {
  return normalizeHex(a, '') === normalizeHex(b, '') && Boolean(a) && Boolean(b)
}

// Plastic-card colors in the Scotiabank / CIBC range: black, red, silver, navy.
export const CARD_BANK_COLORS = [
  '#111111',
  '#2c2c2c',
  '#4a4f57',
  '#8e949e',
  '#d5d2cc',
  '#ec111a',
  '#c8102e',
  '#7a1020',
  '#0a1628',
  '#163a6b',
]

export const CARD_EXTRA_COLORS = [
  '#0f5c4d',
  '#1b7a5c',
  '#0d7377',
  '#1a3a4a',
  '#b8943e',
  '#c9a227',
  '#c4a574',
  '#b87333',
  '#7a2e2e',
  '#4a1942',
  '#3d5a80',
  '#5c6b73',
]
