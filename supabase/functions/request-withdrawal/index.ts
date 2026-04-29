/**
 * POST /functions/v1/request-withdrawal
 * Body: { valor: number, pix_key: string, pix_key_type: 'cpf'|'email'|'phone'|'random' }
 *
 * Embaixadora autenticada solicita resgate. Valida:
 *   - Saldo confirmado disponível ≥ valor (commissions com status=confirmada e resgate_id=NULL)
 *   - Valor ≥ R$100
 *   - Dia atual em BRT ≤ 10
 *   - Sem outro resgate pendente/aprovado
 * Vincula commissions confirmadas (oldest-first) ao novo resgate até atingir o valor.
 */
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase-admin.ts'
import { requireUser } from '../_shared/auth-guard.ts'

const PIX_TYPES = new Set(['cpf', 'email', 'phone', 'random'])

interface Comissao { id: string; valor_comissao: number; criado_em: string }

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 })
  }

  const user = await requireUser(req)
  if (!user) return jsonResponse({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: { valor?: number; pix_key?: string; pix_key_type?: string }
  try { body = await req.json() } catch { return jsonResponse({ ok: false, error: 'invalid_json' }, { status: 400 }) }

  const valor = Number(body.valor)
  const pix_key = String(body.pix_key ?? '').trim()
  const pix_key_type = String(body.pix_key_type ?? '').trim().toLowerCase()

  if (!valor || valor < 100) return jsonResponse({ ok: false, error: 'invalid_amount', message: 'Valor mínimo R$100' }, { status: 400 })
  if (!pix_key) return jsonResponse({ ok: false, error: 'missing_pix_key' }, { status: 400 })
  if (!PIX_TYPES.has(pix_key_type)) return jsonResponse({ ok: false, error: 'invalid_pix_type' }, { status: 400 })

  const dayBRT = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', day: 'numeric' }).format(new Date()))
  if (dayBRT > 10) {
    return jsonResponse({ ok: false, error: 'window_closed', message: 'Resgates só do dia 1 ao 10 de cada mês.' }, { status: 400 })
  }

  const supa = adminClient()

  const { data: emb, error: embErr } = await supa.from('embaixadores')
    .select('id,status').eq('email', user.email).maybeSingle()
  if (embErr || !emb) return jsonResponse({ ok: false, error: 'ambassador_not_found' }, { status: 404 })
  if (emb.status !== 'ativo') return jsonResponse({ ok: false, error: 'ambassador_inactive' }, { status: 403 })

  const { data: pending } = await supa.from('resgates')
    .select('id').eq('embaixador_id', emb.id).in('status', ['solicitado', 'aprovado']).limit(1)
  if (pending && pending.length > 0) {
    return jsonResponse({ ok: false, error: 'has_pending_request', message: 'Você já tem um resgate em andamento.' }, { status: 409 })
  }

  const { data: comsRaw } = await supa.from('comissoes')
    .select('id,valor_comissao,criado_em')
    .eq('embaixador_id', emb.id)
    .eq('status', 'confirmada')
    .is('resgate_id', null)
    .order('criado_em', { ascending: true })
  const coms = (comsRaw ?? []) as Comissao[]

  const saldo = coms.reduce((s, c) => s + Number(c.valor_comissao || 0), 0)
  if (saldo < valor) {
    return jsonResponse({ ok: false, error: 'insufficient_balance', message: `Saldo confirmado disponível: R$${saldo.toFixed(2)}` }, { status: 400 })
  }

  const toLink: string[] = []
  let acc = 0
  for (const c of coms) {
    if (acc >= valor) break
    toLink.push(c.id)
    acc += Number(c.valor_comissao || 0)
  }

  const { data: resgate, error: insErr } = await supa.from('resgates').insert({
    embaixador_id: emb.id,
    valor,
    tipo: 'pix',
    pix_key,
    pix_key_type,
    status: 'solicitado',
  }).select('id').single()

  if (insErr || !resgate) {
    return jsonResponse({ ok: false, error: 'insert_failed', message: insErr?.message ?? 'unknown' }, { status: 500 })
  }

  await supa.from('comissoes').update({ resgate_id: resgate.id }).in('id', toLink)
  await supa.from('embaixadores').update({ pix_key }).eq('id', emb.id)

  return jsonResponse({ ok: true, resgate_id: resgate.id, valor, comissoes_vinculadas: toLink.length })
})
