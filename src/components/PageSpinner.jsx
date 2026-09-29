import { ClockLoader } from 'react-spinners'
import { useTheme } from '../theme/ThemeContext'

const GREEN = '#0f5c4d'
const GOLD = '#b8943e'

export default function PageSpinner({ size = 56 }) {
  const { theme } = useTheme()
  const color = theme === 'light' ? GOLD : GREEN
  return (
    <div className="loading page-spinner" role="status">
      <ClockLoader color={color} size={size} />
    </div>
  )
}
