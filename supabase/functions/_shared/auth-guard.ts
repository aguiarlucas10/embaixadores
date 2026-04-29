import { adminClient, userClient } from './supabase-admin.ts'

export interface AuthedUser {
  id: string
  email: string
}

export async function requireUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const supa = userClient(authHeader)
  const { data, error } = await supa.auth.getUser()
  if (error || !data.user || !data.user.email) return null
  return { id: data.user.id, email: data.user.email }
}

export async function requireAdmin(req: Request): Promise<AuthedUser | null> {
  const user = await requireUser(req)
  if (!user) return null
  const supa = adminClient()
  const { data, error } = await supa.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (error || !data) return null
  return user
}
