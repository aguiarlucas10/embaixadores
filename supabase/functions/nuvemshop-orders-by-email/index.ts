/**
 * GET /functions/v1/nuvemshop-orders-by-email?email=...
 *
 * Usado pelo cadastro para validar se a candidata já é cliente da Saint Germain.
 * Retorna sempre JSON estruturado — mesmo em erro — para o frontend mostrar
 * a causa real (substitui o `safeFetch` que silenciava tudo, causa do bug B1).
 */
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { NuvemshopClient } from '../_shared/nuvemshop-client.ts'

const VALID_PAYMENT_STATUSES = new Set(['paid', 'authorized'])

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)
  const email = url.searchParams.get('email')?.trim().toLowerCase() ?? ''

  if (!email) {
    return jsonResponse({ ok: false, error: 'missing_email', message: 'Parâmetro `email` é obrigatório' }, { status: 400 })
  }

  const result = await NuvemshopClient.ordersByEmail(email)

  if (!result.ok) {
    return jsonResponse({
      ok: false,
      error: result.error.kind,
      message: result.error.message,
      status: result.error.status,
    }, { status: result.error.kind === 'auth' ? 502 : 500 })
  }

  const all = result.data ?? []
  const matchingEmail = all.filter((o) => o.customer?.email?.toLowerCase() === email)
  const paidOrders = matchingEmail.filter((o) => VALID_PAYMENT_STATUSES.has(o.payment_status))

  return jsonResponse({
    ok: true,
    found: paidOrders.length > 0,
    total: matchingEmail.length,
    paid: paidOrders.length,
    orders: paidOrders.map((o) => ({
      id: o.id,
      number: o.number,
      payment_status: o.payment_status,
      created_at: o.created_at,
      total: o.total,
    })),
  })
})
