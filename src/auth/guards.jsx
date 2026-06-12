import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

// Exige sesion iniciada. Si falta el perfil, redirige al onboarding.
export function ProtectedRoute() {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />

  if (user && !user.onboardingCompleted && location.pathname !== '/onboarding')
    return <Navigate to="/onboarding" replace />

  return <Outlet />
}

// Exige rol Admin.
export function AdminRoute() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
