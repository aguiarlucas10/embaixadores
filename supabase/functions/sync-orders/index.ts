/**
 * Cron horário: puxa pedidos novos da Nuvemshop e cria comissões.
 *
 * Idempotente via UNIQUE em comissoes.pedido_id.
 *
 * Chamada também aceita ?since=YYYY-MM-DD para backfill manual:
 *   POST /functions/v1/sync-orders?since=2025-01-01
 */
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { NuvemshopClient, NSOrder } from '../_shared/nuvemshop-client.ts'
import { adminClient } from '../_shared/supabase-admin.ts'

const RETURN_DAYS = Number(Deno.env.get('JANELA_DEVOLUCAO') ?? '7')

interface Embaixadora {
  id: string
  cupom: string
  comissao_pct: number | null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const supa = adminClient()
  const url = new URL(req.url)
  const sinceParam = url.searchParams.get('since')

  let since: string
  if (sinceParam) {
    since = new Date(sinceParam).toISOString()
  } else {
    const { data: cfg } = await supa.from('config').select('valor').eq('chave', 'sync_orders_cursor').maybeSingle()
    since = cfg?.valor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }

  const orders = await NuvemshopClient.ordersSince(since)
  if (!orders.ok) {
    return jsonResponse({
      ok: false,
      error: orders.error.kind,
      message: orders.error.message,
    }, { status: orders.error.kind === 'auth' ? 502 : 500 })
  }

  const { data: embsRaw } = await supa.from('embaixadores')
    .select('id,cupom,comissao_pct')
    .eq('status', 'ativo')
  const embs = (embsRaw ?? []) as Embaixadora[]

  const cupomToEmb = new Map<string, Embaixadora>()
  for (const e of embs) {
    if (e.cupom) cupomToEmb.set(e.cupom.toUpperCase(), e)
  }

  let created = 0
  let skipped = 0
  let errors = 0
  const errorDetails: string[] = []

  for (const o of orders.data) {
    try {
      const code = extractCouponCode(o)
      if (!code) { skipped++; continue }

      const emb = cupomToEmb.get(code.toUpperCase())
      if (!emb) { skipped++; continue }

      const subtotal = computeCommissionableSubtotal(o)
      const pct = emb.comissao_pct ?? 0.10
      const valor_comissao = Math.round(subtotal * pct * 100) / 100

      const dataPedido = o.created_at
      const returnEnds = new Date(new Date(dataPedido).getTime() + RETURN_DAYS * 86400 * 1000).toISOString()

      const { error } = await supa.from('comissoes').upsert({
        embaixador_id: emb.id,
        pedido_id: String(o.id),
        valor_pedido: Number(o.total),
        valor_comissao,
        status: 'pendente',
        payment_status: o.payment_status,
        criado_em: dataPedido,
        data_pedido: dataPedido,
        return_window_ends_at: returnEnds,
      }, { onConflict: 'pedido_id', ignoreDuplicates: false })

      if (error) { errors++; errorDetails.push(`${o.id}: ${error.message}`) }
      else { created++ }
    } catch (e) {
      errors++
      errorDetails.push(`${o.id}: ${String(e)}`)
    }
  }

  // Avança cursor (último created_at processado, ou now)
  const newCursor = orders.data.length > 0
    ? orders.data.reduce((latest, o) => o.created_at > latest ? o.created_at : latest, orders.data[0]!.created_at)
    : new Date().toISOString()
  await supa.from('config').upsert({ chave: 'sync_orders_cursor', valor: newCursor }, { onConflict: 'chave' })

  return jsonResponse({
    ok: true,
    since,
    fetched: orders.data.length,
    created,
    skipped,
    errors,
    errorDetails: errorDetails.slice(0, 10),
    cursor: newCursor,
  })
})

function extractCouponCode(order: NSOrder): string | null {
  if (Array.isArray(order.coupon) && order.coupon.length > 0) {
    return String(order.coupon[0]!.code ?? '')
  }
  if (order.promotional_discount?.code) {
    return String(order.promotional_discount.code)
  }
  return null
}

function computeCommissionableSubtotal(order: NSOrder): number {
  const total = Number(order.total ?? 0)
  const shipping = Number(order.shipping_cost_customer ?? 0)
  const sub = Number(order.subtotal ?? NaN)
  if (!isNaN(sub) && sub > 0) return sub
  return Math.max(0, total - shipping)
}
