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
    // Uma tentativa extra: se um erro transitório (lock, rede) escapar, um
    // retry evita rebaixar o admin a não-admin e mandá-lo pra tela errada.
    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await withTimeout(supabase.rpc('check_is_admin'), 8000, 'check_is_admin')
        if (error) throw error
        setIsAdmin(data === true)
        return
      } catch (e) {
        lastErr = e
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300))
      }
    }
    throw lastErr
  }

  useEffect(() => {
    let cancelled = false
    let resolved = false

    // Rede de segurança: se nenhum evento de auth chegar (storage
    // corrompido, lock do navegador travado, etc.), destrava o spinner sem
    // tocar no estado de login — se o evento real chegar depois, ele corrige.
    const fallback = setTimeout(() => {
      if (!cancelled && !resolved) setChecking(false)
    }, 12000)

    // onAuthStateChange é a ÚNICA fonte de verdade do estado de auth: emite
    // INITIAL_SESSION uma vez no boot e depois SIGNED_IN/SIGNED_OUT/etc.
    // Não chamar getSession() manualmente em paralelo aqui é proposital —
    // isso causava um bug onde um getSession() lento (disputando o lock
    // interno do supabase-js com a própria inicialização) resolvia DEPOIS do
    // SIGNED_IN e deslogava um usuário que já estava autenticado.
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      resolved = true
      clearTimeout(fallback)
      const u = session?.user ?? null
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
      } else {
        setIsAdmin(false)
      }
      if (!cancelled) setChecking(false)
    })

    return () => { cancelled = true; clearTimeout(fallback); listener.subscription.unsubscribe() }
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
