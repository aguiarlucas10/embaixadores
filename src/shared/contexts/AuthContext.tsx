import { createContext, useContext, useEffect, useState, useMemo } from 'react'
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

const ADMIN_EMAILS = (import.meta.env['VITE_ADMIN_EMAILS'] as string ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean)

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setChecking(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(() => {
    const role: AppRole = user
      ? ADMIN_EMAILS.includes(user.email ?? '') ? 'admin' : 'embaixador'
      : null
    const isAdmin = role === 'admin'

    async function logout() {
      await supabase.auth.signOut()
    }

    return { user, checking, role, isAdmin, logout }
  }, [user, checking])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
