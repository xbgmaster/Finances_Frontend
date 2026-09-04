import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

export async function initNativeShell() {
  if (import.meta.env.VITE_NATIVE !== 'true' && !Capacitor.isNativePlatform()) return

  try {
    if (Capacitor.isPluginAvailable('StatusBar')) {
      await StatusBar.setStyle({ style: Style.Light })
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#f3f0e8' })
        await StatusBar.setOverlaysWebView({ overlay: false })
      }
    }
  } catch {
    // Web preview or plugin not yet synced.
  }

  try {
    if (Capacitor.isPluginAvailable('SplashScreen')) {
      await SplashScreen.hide()
    }
  } catch {
    // Ignore on web.
  }
}
