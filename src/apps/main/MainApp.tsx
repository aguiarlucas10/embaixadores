import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '@shared/hooks/useAuth'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import { PageCadastro } from './pages/Cadastro/Cadastro'
import { LoginPage } from './pages/Login/Login'
import { PainelPage } from './pages/Painel/Painel'
import { AdminPage } from './pages/Admin/Admin'

const ADMIN_EMAILS = (import.meta.env['VITE_ADMIN_EMAILS'] as string ?? '')
  .split(',').map(e => e.trim()).filter(Boolean)

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, checking, isAdmin } = useAuth()
  if (checking) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/painel" replace />
  return <>{children}</>
}

function LoginRoute({ children }: { children: React.ReactNode }) {
  const { user, checking, isAdmin } = useAuth()
  if (checking) return <Spinner />
  if (user) return <Navigate to={isAdmin ? '/admin' : '/painel'} replace />
  return <>{children}</>
}

export function MainApp() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout().then(() => navigate('/login'))
  }

  function handleLogin(loggedUser: User) {
    const admin = ADMIN_EMAILS.includes(loggedUser.email ?? '')
    navigate(admin ? '/admin' : '/painel')
  }

  return (
    <Routes>
      <Route path="/" element={
        <LoginRoute>
          <PageCadastro />
        </LoginRoute>
      } />

      <Route path="/login" element={
        <LoginRoute>
          <LoginPage onLogin={handleLogin} />
        </LoginRoute>
      } />

      <Route path="/painel" element={
        <PrivateRoute>
          {user ? <PainelPage user={user} onLogout={handleLogout} /> : null}
        </PrivateRoute>
      } />

      <Route path="/admin" element={
        <PrivateRoute adminOnly>
          {user ? <AdminPage user={user} onLogout={handleLogout} /> : null}
        </PrivateRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
