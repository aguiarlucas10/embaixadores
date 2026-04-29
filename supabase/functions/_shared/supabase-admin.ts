import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function userClient(authHeader: string | null): SupabaseClient {
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
  return createClient(SUPABASE_URL, ANON, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
