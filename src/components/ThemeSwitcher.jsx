import { Sun, Moon } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useTheme } from '../theme/ThemeContext'

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()

  return (
    <div className="theme-switch" role="group" aria-label={t.common.theme}>
      <button
        type="button"
        className={theme === 'light' ? 'active' : ''}
        onClick={() => setTheme('light')}
        aria-pressed={theme === 'light'}
      >
        <Sun size={15} strokeWidth={2} /> {t.common.themeLight}
      </button>
      <button
        type="button"
        className={theme === 'dark' ? 'active' : ''}
        onClick={() => setTheme('dark')}
        aria-pressed={theme === 'dark'}
      >
        <Moon size={15} strokeWidth={2} /> {t.common.themeDark}
      </button>
    </div>
  )
}
