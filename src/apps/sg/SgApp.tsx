import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import { PageLoginSG } from './pages/Login/LoginSG'
import { PagePainelSG } from './pages/Painel/PainelSG'
import { PageAdminSG } from './pages/Admin/AdminSG'

const ADMIN_EMAILS = (import.meta.env['VITE_ADMIN_EMAILS'] as string ?? '')
  .split(',').map(e => e.trim()).filter(Boolean)

function isAdminEmail(email: string | undefined) {
  return ADMIN_EMAILS.includes(email ?? '')
}

function PrivateRouteSG({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, checking } = useAuth()
  if (checking) return <Spinner />
  if (!user) return <Navigate to="login" replace />
  if (adminOnly && !isAdminEmail(user.email ?? '')) return <Navigate to="painel" replace />
  return <>{children}</>
}

function LoginRouteSG({ children }: { children: React.ReactNode }) {
  const { user, checking } = useAuth()
  if (checking) return <Spinner />
  if (user) return <Navigate to={isAdminEmail(user.email ?? '') ? 'admin' : 'painel'} replace />
  return <>{children}</>
}

export function SgApp() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout().then(() => navigate('login'))
  }

  return (
    <Routes>
      <Route index element={<Navigate to="login" replace />} />

      <Route path="login" element={
        <LoginRouteSG>
          <PageLoginSG />
        </LoginRouteSG>
      } />

      <Route path="painel" element={
        <PrivateRouteSG>
          {user ? <PagePainelSG user={user} onLogout={handleLogout} /> : null}
        </PrivateRouteSG>
      } />

      <Route path="admin" element={
        <PrivateRouteSG adminOnly>
          {user ? <PageAdminSG user={user} onLogout={handleLogout} /> : null}
        </PrivateRouteSG>
      } />

      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  )
}
