// Maps built-in category names (any seeded language) to a stable key.
const DEFAULT_CATEGORY_ALIASES = {
  comida: 'food',
  food: 'food',
  transporte: 'transport',
  transport: 'transport',
  transportation: 'transport',
  vivienda: 'housing',
  housing: 'housing',
  home: 'housing',
  entretenimiento: 'entertainment',
  entertainment: 'entertainment',
  salud: 'health',
  health: 'health',
  compras: 'shopping',
  shopping: 'shopping',
  servicios: 'utilities',
  utilities: 'utilities',
  services: 'utilities',
  otros: 'other',
  other: 'other',
  others: 'other',
  'debt payments': 'debtPayments',
  'pagos de deuda': 'debtPayments',
  'pagos de créditos': 'debtPayments',
  'pagos de creditos': 'debtPayments',
}

export function categoryLabel(name, t) {
  if (!name) return name || ''
  const key = DEFAULT_CATEGORY_ALIASES[name.trim().toLowerCase()]
  return (key && t.categories?.defaults?.[key]) || name
}
