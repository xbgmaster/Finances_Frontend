import { Sun, Moon } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { useTheme } from '../theme/ThemeContext'

export default function ThemeSwitcher({ compact = false }) {
  const { theme, setTheme } = useTheme()
  const { t } = useI18n()

  if (compact) {
    const next = theme === 'dark' ? 'light' : 'dark'
    return (
      <button
        type="button"
        className="theme-toggle-btn"
        onClick={() => setTheme(next)}
        aria-label={t.common.theme}
        title={next === 'dark' ? t.common.themeDark : t.common.themeLight}
      >
        {theme === 'dark' ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
      </button>
    )
  }

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
