import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LoadingBar from './components/LoadingBar'
import { ProtectedRoute, AdminRoute, FeatureRoute } from './auth/guards'

// Route-level code splitting: each page ships in its own chunk so the initial
// load (e.g. the login screen) no longer pulls every page + recharts at once.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Categories = lazy(() => import('./pages/Categories'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Credits = lazy(() => import('./pages/Credits'))
const CreditDetail = lazy(() => import('./pages/CreditDetail'))
const Cards = lazy(() => import('./pages/Cards'))
const CardDetail = lazy(() => import('./pages/CardDetail'))
const BudgetHistory = lazy(() => import('./pages/BudgetHistory'))
const Projections = lazy(() => import('./pages/Projections'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Password = lazy(() => import('./pages/ForgotPassword'))
const RestorePassword = lazy(() => import('./pages/RestorePassword'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminFeatures = lazy(() => import('./pages/AdminFeatures'))
const Payroll = lazy(() => import('./pages/Payroll'))

export default function App() {
  return (
    <>
      <LoadingBar />
      <Suspense fallback={<div className="loading">…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/password" element={<Password />} />
        <Route path="/restore-password" element={<RestorePassword />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="categories" element={<Categories />} />
            <Route element={<FeatureRoute feature="expenses" />}>
              <Route path="expenses" element={<Expenses />} />
            </Route>
            <Route element={<FeatureRoute feature="credits" />}>
              <Route path="credits" element={<Credits />} />
              <Route path="credits/:id" element={<CreditDetail />} />
            </Route>
            <Route element={<FeatureRoute feature="cards" />}>
              <Route path="cards" element={<Cards />} />
              <Route path="cards/:id" element={<CardDetail />} />
            </Route>
            <Route element={<FeatureRoute feature="budget" />}>
              <Route path="budget-history" element={<BudgetHistory />} />
            </Route>
            <Route element={<FeatureRoute feature="projections" />}>
              <Route path="projections" element={<Projections />} />
            </Route>
            {/* Opt-in module: hidden by default, granted per user from Feature access. */}
            <Route element={<FeatureRoute feature="payroll" />}>
              <Route path="payroll" element={<Payroll />} />
            </Route>
            <Route path="settings" element={<Settings />} />
            <Route element={<AdminRoute />}>
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/features" element={<AdminFeatures />} />
            </Route>
          </Route>
        </Route>
      </Routes>
      </Suspense>
    </>
  )
}
