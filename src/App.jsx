import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import Expenses from './pages/Expenses'
import Projections from './pages/Projections'
import Login from './pages/Login'
import Register from './pages/Register'
import Password from './pages/ForgotPassword'
import RestorePassword from './pages/RestorePassword'
import Onboarding from './pages/Onboarding'
import AdminDashboard from './pages/AdminDashboard'
import { ProtectedRoute, AdminRoute } from './auth/guards'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/password" element={<Password />} />
      <Route path="/restore-password" element={<RestorePassword />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="categorias" element={<Categories />} />
          <Route path="gastos" element={<Expenses />} />
          <Route path="proyecciones" element={<Projections />} />
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
