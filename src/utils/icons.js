// Mapa de clave de icono -> emoji. Evita dependencias extra de iconos.
export const ICONS = {
  utensils: '🍽️',
  car: '🚗',
  home: '🏠',
  film: '🎬',
  heart: '❤️',
  'shopping-bag': '🛍️',
  bolt: '⚡',
  tag: '🏷️',
  coffee: '☕',
  plane: '✈️',
  gift: '🎁',
  book: '📚',
  dumbbell: '🏋️',
  phone: '📱',
  pet: '🐾',
  baby: '🍼',
  music: '🎵',
  gas: '⛽',
  bank: '🏦',
  savings: '🐷',
}

export const ICON_KEYS = Object.keys(ICONS)

export const iconFor = (key) => ICONS[key] || ICONS.tag

// Paleta sugerida para categorias nuevas.
export const COLOR_PALETTE = [
  '#6366f1', '#f59e0b', '#3b82f6', '#10b981', '#ec4899',
  '#ef4444', '#8b5cf6', '#14b8a6', '#64748b', '#f97316',
]
