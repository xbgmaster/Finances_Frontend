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
  card: '💳',
  cash: '💵',
  wallet: '👛',
}

export const ICON_KEYS = Object.keys(ICONS)

export const iconFor = (key) => ICONS[key] || ICONS.tag

// Paleta sugerida para categorias nuevas.
export const COLOR_PALETTE = [
  '#0f5c4d', '#b8943e', '#1a3a4a', '#5a8f7b', '#c4a574',
  '#7a2e2e', '#0d7377', '#6b7c3d', '#5c6b73', '#b87333',
]
