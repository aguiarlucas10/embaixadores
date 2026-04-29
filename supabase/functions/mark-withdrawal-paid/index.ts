/**
 * POST /functions/v1/mark-withdrawal-paid
 * Body: { resgate_id: string, payment_proof_url?: string, notes?: string }
 *
 * Admin marca um resgate como pago. As comissões vinculadas viram status=paga
 * e ficam com resgatada=true (compatibilidade com flag legado).
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

  let body: { resgate_id?: string; payment_proof_url?: string; notes?: string }
  try { body = await req.json() } catch { return jsonResponse({ ok: false, error: 'invalid_json' }, { status: 400 }) }

  const resgate_id = String(body.resgate_id ?? '').trim()
  if (!resgate_id) return jsonResponse({ ok: false, error: 'missing_resgate_id' }, { status: 400 })

  const supa = adminClient()
  const now = new Date().toISOString()

  const { data, error } = await supa.from('resgates').update({
    status: 'pago',
    paid_at: now,
    paid_by: admin.id,
    payment_proof_url: body.payment_proof_url ?? null,
    admin_notes: body.notes ?? null,
  }).eq('id', resgate_id).in('status', ['solicitado', 'aprovado']).select('id').single()

  if (error || !data) {
    return jsonResponse({ ok: false, error: 'update_failed', message: error?.message ?? 'Resgate não pode ser marcado como pago' }, { status: 400 })
  }

  // Atualiza comissões vinculadas
  await supa.from('comissoes').update({
    status: 'paga',
    resgatada: true,
    paid_at: now,
  }).eq('resgate_id', data.id)

  return jsonResponse({ ok: true, resgate_id: data.id, status: 'pago' })
})
