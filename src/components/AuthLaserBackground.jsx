import { lazy, Suspense } from 'react'

// Heavy WebGL/three.js effect: load it only when an auth page renders.
const LaserFlow = lazy(() => import('./LaserFlow'))

// Shared animated background for all unauthenticated pages (login, register,
// password recovery, onboarding). Sits behind the auth card; a CSS glow in
// `.laser-bg` keeps the page elegant even if WebGL is unavailable.
export default function AuthLaserBackground() {
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
    </div>
  )
}
