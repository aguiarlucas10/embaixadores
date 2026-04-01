import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@shared/hooks/useAuth'
import { Spinner } from '@shared/components/atoms/Spinner/Spinner'
import { PageLoginSG } from './pages/Login/LoginSG'
import { PagePainelSG } from './pages/Painel/PainelSG'
import { PageAdminSG } from './pages/Admin/AdminSG'

function PrivateRouteSG({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, checking, isAdmin } = useAuth()
  if (checking) return <Spinner />
  if (!user) return <Navigate to="login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="painel" replace />
  return <>{children}</>
}

function LoginRouteSG({ children }: { children: React.ReactNode }) {
  const { user, checking, isAdmin } = useAuth()
  if (checking) return <Spinner />
  const isRecovery = window.location.hash.includes('type=recovery')
  if (user && !isRecovery) return <Navigate to={isAdmin ? 'admin' : 'painel'} replace />
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
