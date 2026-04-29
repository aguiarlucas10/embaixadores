/**
 * Edge Function de cupons Nuvemshop.
 *
 * Substitui as actions `check_coupon` e `create_coupon` da `bright-api` antiga,
 * que retornavam `{exists: false}` em qualquer erro — fazendo todas as opções
 * aparecerem como "indisponíveis" quando na verdade era falha de auth (bug B2).
 *
 * Aqui o `check` retorna 4 estados explícitos:
 *   - `available` → cupom não existe na NS, pode criar
 *   - `taken`     → cupom já existe
 *   - `error_auth`→ token NS inválido (frontend mostra "erro de configuração")
 *   - `error_other` → outro erro (frontend mostra "tente novamente")
 */
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { NuvemshopClient } from '../_shared/nuvemshop-client.ts'

interface CheckBody { action: 'check'; code: string }
interface CreateBody { action: 'create'; code: string; percentage: number }
type Body = CheckBody | CreateBody

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 })
  }

  let body: Body
  try {
    body = await req.json() as Body
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  if (!body.action || !body.code) {
    return jsonResponse({ ok: false, error: 'missing_fields', message: '`action` e `code` são obrigatórios' }, { status: 400 })
  }

  const code = body.code.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) {
    return jsonResponse({ ok: false, error: 'invalid_code', message: 'Código de cupom inválido' }, { status: 400 })
  }

  if (body.action === 'check') {
    const result = await NuvemshopClient.findCouponByCode(code)
    if (!result.ok) {
      return jsonResponse({
        ok: false,
        state: result.error.kind === 'auth' ? 'error_auth' : 'error_other',
        message: result.error.message,
      }, { status: result.error.kind === 'auth' ? 502 : 500 })
    }
    return jsonResponse({
      ok: true,
      state: result.data ? 'taken' : 'available',
      coupon: result.data,
    })
  }

  if (body.action === 'create') {
    if (!body.percentage || body.percentage <= 0 || body.percentage > 100) {
      return jsonResponse({ ok: false, error: 'invalid_percentage' }, { status: 400 })
    }

    const existing = await NuvemshopClient.findCouponByCode(code)
    if (!existing.ok) {
      return jsonResponse({
        ok: false,
        state: existing.error.kind === 'auth' ? 'error_auth' : 'error_other',
        message: existing.error.message,
      }, { status: existing.error.kind === 'auth' ? 502 : 500 })
    }
    if (existing.data) {
      return jsonResponse({ ok: false, state: 'taken', message: 'Cupom já existe' }, { status: 409 })
    }

    const created = await NuvemshopClient.createCoupon({ code, percentage: body.percentage })
    if (!created.ok) {
      return jsonResponse({
        ok: false,
        state: created.error.kind === 'auth' ? 'error_auth' : 'error_other',
        message: created.error.message,
      }, { status: created.error.kind === 'auth' ? 502 : 500 })
    }
    return jsonResponse({ ok: true, state: 'created', coupon: created.data })
  }

  return jsonResponse({ ok: false, error: 'unknown_action' }, { status: 400 })
})
