/**
 * Cron diário: encerra a janela de devolução das comissões.
 *
 * Para cada `comissoes.status='pendente'` com `return_window_ends_at < now()`:
 *   - Refaz GET do pedido na Nuvemshop
 *   - Se segue paid e não cancelado/devolvido → confirmada (+ confirmed_at)
 *   - Se cancelado/refunded → cancelada (+ cancelled_at, cancelled_reason)
 */
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { NuvemshopClient } from '../_shared/nuvemshop-client.ts'
import { adminClient } from '../_shared/supabase-admin.ts'

interface ComissaoRow {
  id: string
  pedido_id: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const supa = adminClient()
  const now = new Date().toISOString()

  const { data: pendentesRaw, error: fetchErr } = await supa.from('comissoes')
    .select('id,pedido_id')
    .eq('status', 'pendente')
    .lt('return_window_ends_at', now)
    .limit(500)

  if (fetchErr) {
    return jsonResponse({ ok: false, error: 'db_fetch_failed', message: fetchErr.message }, { status: 500 })
  }

  const pendentes = (pendentesRaw ?? []) as ComissaoRow[]

  let confirmed = 0
  let cancelled = 0
  let errors = 0

  for (const c of pendentes) {
    try {
      const order = await NuvemshopClient.getOrder(c.pedido_id)
      if (!order.ok) {
        errors++
        continue
      }

      const o = order.data
      const isCancelled = o.status === 'cancelled' || o.payment_status === 'refunded' || o.payment_status === 'voided'
      const isPaid = o.payment_status === 'paid'

      if (isCancelled) {
        await supa.from('comissoes').update({
          status: 'cancelada',
          cancelled_at: now,
          cancelled_reason: o.payment_status,
          payment_status: o.payment_status,
        }).eq('id', c.id)
        cancelled++
      } else if (isPaid) {
        await supa.from('comissoes').update({
          status: 'confirmada',
          confirmed_at: now,
          payment_status: o.payment_status,
        }).eq('id', c.id)
        confirmed++
      }
    } catch {
      errors++
    }
  }

  return jsonResponse({
    ok: true,
    processed: pendentes.length,
    confirmed,
    cancelled,
    errors,
  })
})
