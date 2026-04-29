/**
 * POST /functions/v1/reject-withdrawal
 * Body: { resgate_id: string, notes?: string }
 *
 * Admin rejeita um resgate. As comissões vinculadas voltam para o saldo
 * disponível (resgate_id volta a ser NULL).
 */
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase-admin.ts'
import { requireAdmin } from '../_shared/auth-guard.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 })

  const admin = await requireAdmin(req)
  if (!admin) return jsonResponse({ ok: false, error: 'forbidden' }, { status: 403 })

  let body: { resgate_id?: string; notes?: string }
  try { body = await req.json() } catch { return jsonResponse({ ok: false, error: 'invalid_json' }, { status: 400 }) }

  const resgate_id = String(body.resgate_id ?? '').trim()
  if (!resgate_id) return jsonResponse({ ok: false, error: 'missing_resgate_id' }, { status: 400 })

  const supa = adminClient()
  const now = new Date().toISOString()

  const { data, error } = await supa.from('resgates').update({
    status: 'rejeitado',
    rejected_at: now,
    approved_by: admin.id,
    admin_notes: body.notes ?? null,
  }).eq('id', resgate_id).in('status', ['solicitado', 'aprovado']).select('id').single()

  if (error || !data) {
    return jsonResponse({ ok: false, error: 'update_failed', message: error?.message ?? 'Resgate não pode ser rejeitado' }, { status: 400 })
  }

  // Solta as comissões para reentrar no saldo confirmado
  await supa.from('comissoes').update({ resgate_id: null }).eq('resgate_id', data.id)

  return jsonResponse({ ok: true, resgate_id: data.id, status: 'rejeitado' })
})
