import { useI18n } from '../i18n/I18nContext'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useI18n()

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button
        className={language === 'en' ? 'active' : ''}
        onClick={() => setLanguage('en')}
      >
        🇬🇧 EN
      </button>
      <button
        className={language === 'es' ? 'active' : ''}
        onClick={() => setLanguage('es')}
      >
        🇪🇸 ES
      </button>
    </div>
  )
}
