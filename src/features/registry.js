// Modules an admin can turn on/off per user. Keys match the values stored on the backend
// (lower-case). Summary, Categories and Settings are always visible (not listed here).
//
// `defaultOn`:
//   - true  -> visible by default for all roles unless explicitly overridden (blocklist).
//   - false -> hidden by default for User role; visible by default for Premium+Admin.
//
// Role hierarchy:
//   Admin   – full access, bypasses this system entirely (isAdmin guard).
//   Premium – all modules including opt-in ones (payroll is ON by default).
//   User    – all defaultOn:true modules; opt-in modules (payroll) are OFF unless granted.
//
// The stored "overrides" set holds: opt-out modules that were HIDDEN + opt-in modules that
// were GRANTED — same mechanics as before, but now role-aware.
export const GATEABLE_FEATURES = [
  { key: 'expenses',     navKey: 'expenses',      path: '/expenses',      extraPaths: [],                        defaultOn: true  },
  { key: 'cards',        navKey: 'cards',          path: '/cards',         extraPaths: ['/cards/:id'],            defaultOn: true  },
  { key: 'credits',      navKey: 'credits',        path: '/credits',       extraPaths: ['/credits/:id'],          defaultOn: true  },
  { key: 'budget',       navKey: 'budgetHistory',  path: '/budget-history',extraPaths: [],                        defaultOn: true  },
  { key: 'projections',  navKey: 'projections',    path: '/projections',   extraPaths: [],                        defaultOn: true  },
  // payroll is opt-in for User (defaultOn:false) but ON by default for Premium.
  { key: 'payroll',      navKey: 'payroll',        path: '/payroll',       extraPaths: [],                        defaultOn: false },
]

export const FEATURE_KEYS = GATEABLE_FEATURES.map((f) => f.key)
export const FEATURE_MAP  = Object.fromEntries(GATEABLE_FEATURES.map((f) => [f.key, f]))

export const ROLES = ['User', 'Premium', 'Admin']

/**
 * Is this module visible by default for the given role (ignoring per-user overrides)?
 * Admin always gets everything (handled by isAdmin in AuthContext).
 */
export function getRoleDefault(key, role = 'User') {
  const f = FEATURE_MAP[key]
  if (!f) return true
  if (role === 'Admin' || role === 'Premium') return true   // Premium gets everything by default
  return f.defaultOn !== false                               // User gets only defaultOn:true
}

/**
 * Resolve whether a module is visible for a user given their role and per-user overrides.
 * The override set INVERTS the role default (same semantics as before, but role-aware):
 *   role default ON  + key in overrides → hidden   (admin disabled it for this user)
 *   role default OFF + key in overrides → visible   (admin enabled it for this user)
 */
export function isFeatureVisible(key, overrides = [], role = 'User') {
  const roleDefault = getRoleDefault(key, role)
  const inSet = overrides.includes(key)
  return roleDefault ? !inSet : inSet
}
