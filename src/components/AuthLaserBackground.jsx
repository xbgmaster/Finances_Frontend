import { lazy, Suspense, useEffect, useRef } from 'react'

// Heavy WebGL/three.js effect: load it only when an auth page renders.
const LaserFlow = lazy(() => import('./LaserFlow'))

// Shared animated background for all unauthenticated pages (login, register,
// password recovery, onboarding). Sits behind the auth card; a CSS glow in
// `.laser-bg` keeps the page elegant even if WebGL is unavailable.
//
// It also layers a "reveal" image that stays dark and is uncovered by a spotlight
// that follows the pointer (the mask position is driven by the --mx/--my CSS vars),
// mirroring the ReactBits LaserFlow "Usage" example.
export default function AuthLaserBackground() {
  const revealRef = useRef(null)

  useEffect(() => {
    const el = revealRef.current
    if (!el) return

    // The reveal image covers the fixed full-viewport background, so viewport
    // (client) coordinates map directly to the mask position.
    const onMove = (e) => {
      el.style.setProperty('--mx', `${e.clientX}px`)
      el.style.setProperty('--my', `${e.clientY}px`)
    }
    const hide = () => {
      el.style.setProperty('--mx', '-9999px')
      el.style.setProperty('--my', '-9999px')
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    document.addEventListener('mouseleave', hide)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      document.removeEventListener('mouseleave', hide)
    }
  }, [])

  return (
    <div className="laser-bg" aria-hidden="true">
      <Suspense fallback={null}>
        <LaserFlow
          color="#3034eb"
          wispDensity={0.8}
          flowSpeed={0.45}
          verticalSizing={5}
          horizontalSizing={1.9}
          fogIntensity={0.85}
          fogScale={0.1}
          flowStrength={0.35}
          decay={1.8}
          wispSpeed={15}
          wispIntensity={6}
          horizontalBeamOffset={0}
          verticalBeamOffset={-0.5}
        />
      </Suspense>
      <img ref={revealRef} className="laser-reveal" src="/login-reveal.png" alt="" />
    </div>
  )
}
