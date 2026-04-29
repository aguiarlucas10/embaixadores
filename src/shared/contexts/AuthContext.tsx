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

// Garante que nenhuma chamada de auth pode pendurar a UI indefinidamente.
// Se passar do prazo a Promise rejeita e o catch destrava o `checking`.
function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  async function checkAdmin() {
    const { data, error } = await withTimeout(supabase.rpc('check_is_admin'), 1000, 'check_is_admin')
    if (error) throw error
    setIsAdmin(data === true)
  }

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 1000, 'getSession')
        if (cancelled) return
        const u = data.session?.user ?? null
        setUser(u)
        if (u) {
          try {
            await checkAdmin()
          } catch (rpcErr) {
            // RPC falhou (timeout, rede, função indisponível, etc.) —
            // mantém a sessão e assume não-admin. NÃO desloga o usuário.
            console.warn('[Auth] check_is_admin falhou, assumindo não-admin:', rpcErr)
            if (!cancelled) setIsAdmin(false)
          }
        }
      } catch (e) {
        // Falha em getSession (storage corrompido, etc.) — segue como
        // deslogado. signOut local apenas, sem invalidar no servidor.
        console.error('[Auth] getSession falhou:', e)
        if (!cancelled) {
          setUser(null)
          setIsAdmin(false)
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    void bootstrap()

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

    return () => { cancelled = true; listener.subscription.unsubscribe() }
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
