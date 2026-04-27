import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@shared/services/supabase'

export type AppRole = 'admin' | 'embaixador' | null

interface AuthState {
  user: User | null
  checking: boolean
  role: AppRole
  isAdmin: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  async function checkAdmin() {
    const { data, error } = await supabase.rpc('check_is_admin')
    if (error) throw error
    setIsAdmin(data === true)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) {
        try {
          await checkAdmin()
        } catch {
          // Token expirado ou corrompido — limpar sessão para destravar o app
          await supabase.auth.signOut()
          setUser(null)
          setIsAdmin(false)
        }
      }
      setChecking(false)
    }).catch(() => {
      // Fallback: garantir que o app nunca fica travado no spinner
      setChecking(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        try {
          await checkAdmin()
        } catch {
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const role: AppRole = user ? (isAdmin ? 'admin' : 'embaixador') : null

  return (
    <AuthContext.Provider value={{ user, checking, role, isAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
