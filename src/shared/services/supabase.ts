import { createClient, type PostgrestSingleResponse } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env['VITE_SUPABASE_URL'] as string
const supabaseAnonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas. ' +
      'Crie um arquivo .env baseado no .env.example.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Supabase devolve no máximo 1000 linhas por request — pagina até esgotar.
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<PostgrestSingleResponse<T[]>>
): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let i = 0; ; i++) {
    const { data, error } = await build(i * PAGE, (i + 1) * PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}
