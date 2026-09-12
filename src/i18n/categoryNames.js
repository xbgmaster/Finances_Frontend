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
  // Common everyday categories (recognized in either language so they localize on display).
  mercado: 'groceries',
  supermercado: 'groceries',
  groceries: 'groceries',
  restaurante: 'restaurants',
  restaurantes: 'restaurants',
  restaurants: 'restaurants',
  gasolina: 'fuel',
  combustible: 'fuel',
  fuel: 'fuel',
  gas: 'fuel',
  renta: 'rent',
  alquiler: 'rent',
  arriendo: 'rent',
  rent: 'rent',
  educación: 'education',
  educacion: 'education',
  education: 'education',
  suscripciones: 'subscriptions',
  suscripción: 'subscriptions',
  suscripcion: 'subscriptions',
  subscriptions: 'subscriptions',
  subscription: 'subscriptions',
  gimnasio: 'gym',
  gym: 'gym',
  viaje: 'travel',
  viajes: 'travel',
  travel: 'travel',
  regalo: 'gifts',
  regalos: 'gifts',
  gift: 'gifts',
  gifts: 'gifts',
  mascota: 'pets',
  mascotas: 'pets',
  pet: 'pets',
  pets: 'pets',
  ahorro: 'savings',
  ahorros: 'savings',
  savings: 'savings',
  impuesto: 'taxes',
  impuestos: 'taxes',
  taxes: 'taxes',
  seguro: 'insurance',
  seguros: 'insurance',
  insurance: 'insurance',
  ropa: 'clothing',
  vestuario: 'clothing',
  clothing: 'clothing',
  clothes: 'clothing',
  internet: 'internet',
  teléfono: 'phone',
  telefono: 'phone',
  celular: 'phone',
  móvil: 'phone',
  movil: 'phone',
  phone: 'phone',
  café: 'coffee',
  cafe: 'coffee',
  coffee: 'coffee',
  belleza: 'beauty',
  beauty: 'beauty',
}

export function categoryLabel(name, t) {
  if (!name) return name || ''
  const key = DEFAULT_CATEGORY_ALIASES[name.trim().toLowerCase()]
  return (key && t.categories?.defaults?.[key]) || name
}

// The seeded cash account is stored under a language-neutral name ("Cash"); older
// accounts may still be stored as "Efectivo". Both localize to the current language.
const CASH_ACCOUNT_ALIASES = new Set(['cash', 'efectivo'])

export function accountLabel(name, t) {
  if (!name) return name || ''
  if (CASH_ACCOUNT_ALIASES.has(name.trim().toLowerCase())) return t.cards?.typeCash || name
  return name
}
