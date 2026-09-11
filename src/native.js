import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

const isNative = () => import.meta.env.VITE_NATIVE === 'true' || Capacitor.isNativePlatform()

const THEME_BG = { light: '#f3f0e8', dark: '#0f1512' }

/**
 * Sync the native status bar with the active theme (no-op on the web).
 * Style.Light = dark text on a light bar; Style.Dark = light text on a dark bar.
 */
export async function applyNativeTheme(theme) {
  if (!isNative()) return
  try {
    if (Capacitor.isPluginAvailable('StatusBar')) {
      await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light })
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: THEME_BG[theme] ?? THEME_BG.light })
        await StatusBar.setOverlaysWebView({ overlay: false })
      }
    }
  } catch {
    // Web preview or plugin not yet synced.
  }
}

export async function initNativeShell() {
  if (!isNative()) return

  const saved = (() => {
    try { return localStorage.getItem('finances.theme') } catch { return null }
  })()
  await applyNativeTheme(saved === 'dark' ? 'dark' : 'light')

  try {
    if (Capacitor.isPluginAvailable('SplashScreen')) {
      await SplashScreen.hide()
    }
  } catch {
    // Ignore on web.
  }
}
