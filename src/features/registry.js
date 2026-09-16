// Modules an admin can turn on/off per user. Keys match the values stored on the backend
// (lower-case). Summary, Categories and Settings are always visible (not listed here).
//
// `defaultOn`:
//   - true  -> opt-out: visible by default; admin can hide it (blocklist behavior).
//   - false -> opt-in:  hidden by default; the user only sees it if the admin grants it.
//
// The stored string is an "overrides" set: it holds opt-out modules that were HIDDEN and
// opt-in modules that were GRANTED, so a single list expresses both behaviors.
export const GATEABLE_FEATURES = [
  { key: 'expenses', navKey: 'expenses', path: '/expenses', defaultOn: true },
  { key: 'cards', navKey: 'cards', path: '/cards', extraPaths: ['/cards/:id'], defaultOn: true },
  { key: 'credits', navKey: 'credits', path: '/credits', extraPaths: ['/credits/:id'], defaultOn: true },
  { key: 'budget', navKey: 'budgetHistory', path: '/budget-history', defaultOn: true },
  { key: 'projections', navKey: 'projections', path: '/projections', defaultOn: true },
  { key: 'payroll', navKey: 'payroll', path: '/payroll', defaultOn: false },
]

export const FEATURE_KEYS = GATEABLE_FEATURES.map((f) => f.key)
export const FEATURE_MAP = Object.fromEntries(GATEABLE_FEATURES.map((f) => [f.key, f]))

// Resolve whether a module is visible for a user given their overrides set.
export function isFeatureVisible(key, overrides = []) {
  const f = FEATURE_MAP[key]
  const defaultOn = f ? f.defaultOn !== false : true
  const inSet = overrides.includes(key)
  return defaultOn ? !inSet : inSet
}
