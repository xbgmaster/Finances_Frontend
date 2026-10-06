const ORDER = ['Debit', 'CreditCard', 'Cash']

// Renders <optgroup> blocks (Debit, Credit cards, Cash) for an account <select>.
// `methods` should already be filtered (currency, archived, etc.).
export default function AccountOptionGroups({ methods, accountLabel, labels, excludeTypes = [], formatOption }) {
  const text = formatOption || ((p) => accountLabel(p.name))
  return ORDER
    .filter((type) => !excludeTypes.includes(type))
    .map((type) => {
      const group = methods.filter((p) => p.type === type)
      if (group.length === 0) return null
      return (
        <optgroup key={type} label={labels[type]}>
          {group.map((p) => (
            <option key={p.id} value={p.id}>{text(p)}</option>
          ))}
        </optgroup>
      )
    })
}
