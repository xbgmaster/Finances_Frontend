import { createElement } from 'react'
import {
  Utensils, Car, Home, Film, Heart, ShoppingBag, Zap, Tag, Coffee, Plane, Gift,
  BookOpen, Dumbbell, Smartphone, PawPrint, Baby, Music, Fuel, Landmark, PiggyBank,
  CreditCard, Banknote, Wallet, ArrowUpRight, ArrowLeftRight,
} from 'lucide-react'

// Single, consistent icon set (lucide) keyed by the same names stored in the DB,
// so existing category records keep working while the UI looks uniform everywhere.
const ICON_COMPONENTS = {
  utensils: Utensils,
  car: Car,
  home: Home,
  film: Film,
  heart: Heart,
  'shopping-bag': ShoppingBag,
  bolt: Zap,
  tag: Tag,
  coffee: Coffee,
  plane: Plane,
  gift: Gift,
  book: BookOpen,
  dumbbell: Dumbbell,
  phone: Smartphone,
  pet: PawPrint,
  baby: Baby,
  music: Music,
  gas: Fuel,
  bank: Landmark,
  savings: PiggyBank,
  card: CreditCard,
  cash: Banknote,
  wallet: Wallet,
}

export const ICON_KEYS = Object.keys(ICON_COMPONENTS)

/** Renders a category icon element for the given key. */
export const iconFor = (key, props = {}) =>
  createElement(ICON_COMPONENTS[key] || Tag, { size: 18, strokeWidth: 2, ...props })

// Payment-method type -> icon: credit card, debit (bank), cash.
const PM_ICON = { CreditCard, Debit: Landmark, Cash: Banknote }

/** Renders the icon for a payment-method type ('CreditCard' | 'Debit' | 'Cash'). */
export const pmTypeIcon = (type, props = {}) =>
  createElement(PM_ICON[type] || CreditCard, { size: 16, strokeWidth: 2, ...props })

/** Common activity glyphs, as elements. */
export const incomeIcon = (props = {}) =>
  createElement(ArrowUpRight, { size: 18, strokeWidth: 2, ...props })
export const exchangeIcon = (props = {}) =>
  createElement(ArrowLeftRight, { size: 18, strokeWidth: 2, ...props })

// Paleta sugerida para categorias nuevas.
export const COLOR_PALETTE = [
  '#0f5c4d', '#b8943e', '#1a3a4a', '#5a8f7b', '#c4a574',
  '#7a2e2e', '#0d7377', '#6b7c3d', '#5c6b73', '#b87333',
]
