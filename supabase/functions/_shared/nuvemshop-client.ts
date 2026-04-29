/**
 * Cliente tipado da API Nuvemshop com tratamento explícito de erros.
 *
 * Substitui o `safeFetch` antigo que silenciava todas as falhas (causa raiz dos
 * bugs B1 — cadastro não validava — e B2 — todos os cupons aparecendo como
 * indisponível). Aqui erros viram resultados estruturados (`error_auth`,
 * `error_not_found`, `error_rate_limit`, `error_other`) que o frontend pode
 * traduzir para mensagens úteis.
 */

const STORE_ID = Deno.env.get('NUVEMSHOP_STORE_ID')
const TOKEN = Deno.env.get('NUVEMSHOP_TOKEN')
const USER_AGENT = Deno.env.get('NUVEMSHOP_USER_AGENT') ?? 'SG Embaixadoras (suporte@saintgermainbrand.com.br)'

if (!STORE_ID || !TOKEN) {
  console.error('NUVEMSHOP_STORE_ID e NUVEMSHOP_TOKEN são obrigatórios')
}

const BASE = `https://api.tiendanube.com/v1/${STORE_ID}`

const baseHeaders: Record<string, string> = {
  'Authentication': `bearer ${TOKEN}`,
  'User-Agent': USER_AGENT,
  'Content-Type': 'application/json',
}

export type NSErrorKind = 'auth' | 'not_found' | 'rate_limit' | 'network' | 'other'

export interface NSError {
  kind: NSErrorKind
  status?: number
  message: string
  raw?: unknown
}

export type NSResult<T> = { ok: true; data: T } | { ok: false; error: NSError }

export interface NSOrder {
  id: number
  number: number
  status: string
  payment_status: string
  created_at: string
  total: string
  subtotal: string
  shipping_cost_customer?: string
  customer?: { email?: string; name?: string; identification?: string }
  coupon?: Array<{ code: string }>
  promotional_discount?: { id: number; code: string }
}

export interface NSCoupon {
  id: number
  code: string
  type: string
  value: string
  valid: boolean
  used: number
  max_uses: number | null
}

async function ns<T>(path: string, init: RequestInit = {}): Promise<NSResult<T>> {
  if (!STORE_ID || !TOKEN) {
    return { ok: false, error: { kind: 'auth', message: 'Credenciais Nuvemshop não configuradas' } }
  }

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...baseHeaders, ...(init.headers ?? {}) },
    })
  } catch (e) {
    return { ok: false, error: { kind: 'network', message: `Falha de rede: ${String(e)}` } }
  }

  if (response.status === 401 || response.status === 403) {
    const body = await response.text()
    return {
      ok: false,
      error: { kind: 'auth', status: response.status, message: 'Token Nuvemshop inválido ou sem permissão', raw: body },
    }
  }

  if (response.status === 404) {
    return { ok: false, error: { kind: 'not_found', status: 404, message: 'Recurso não encontrado' } }
  }

  if (response.status === 429) {
    return { ok: false, error: { kind: 'rate_limit', status: 429, message: 'Rate limit excedido' } }
  }

  if (!response.ok) {
    const body = await response.text()
    return {
      ok: false,
      error: { kind: 'other', status: response.status, message: `HTTP ${response.status}`, raw: body },
    }
  }

  const data = (await response.json()) as T
  return { ok: true, data }
}

export const NuvemshopClient = {
  async ordersByEmail(email: string): Promise<NSResult<NSOrder[]>> {
    const q = encodeURIComponent(email)
    return ns<NSOrder[]>(`/orders?q=${q}&per_page=50`)
  },

  async ordersByCoupon(code: string): Promise<NSResult<NSOrder[]>> {
    const q = encodeURIComponent(code)
    return ns<NSOrder[]>(`/orders?coupon=${q}&per_page=200`)
  },

  async ordersSince(sinceISO: string): Promise<NSResult<NSOrder[]>> {
    const q = encodeURIComponent(sinceISO)
    return ns<NSOrder[]>(`/orders?created_at_min=${q}&per_page=200`)
  },

  async getOrder(orderId: number | string): Promise<NSResult<NSOrder>> {
    return ns<NSOrder>(`/orders/${orderId}`)
  },

  async findCouponByCode(code: string): Promise<NSResult<NSCoupon | null>> {
    const result = await ns<NSCoupon[]>(`/coupons?code=${encodeURIComponent(code)}`)
    if (!result.ok) return result
    const exact = result.data.find((c) => c.code.toUpperCase() === code.toUpperCase())
    return { ok: true, data: exact ?? null }
  },

  async createCoupon(input: { code: string; percentage: number }): Promise<NSResult<NSCoupon>> {
    const body = JSON.stringify({
      code: input.code,
      type: 'percentage',
      value: String(input.percentage),
      valid: true,
      includes_shipping: false,
      first_consumer_purchase: false,
    })
    return ns<NSCoupon>(`/coupons`, { method: 'POST', body })
  },
}
