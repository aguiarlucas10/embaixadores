/**
 * Cliente para a API da Nuvemshop via Supabase Edge Function (proxy).
 *
 * As chamadas vão para: {SUPABASE_URL}/functions/v1/bright-api?action=...
 * Isso evita bloqueio de CORS ao chamar a API da Nuvemshop direto do browser.
 *
 * Tokens de API de terceiros (Nuvemshop, Meta) ficam APENAS no servidor
 * (variáveis de ambiente da Edge Function bright-api).
 * O front NUNCA acessa essas APIs diretamente.
 */

const proxy = `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/bright-api`
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${import.meta.env['VITE_SUPABASE_ANON_KEY']}`,
}

export interface NuvemshopOrder {
  id: number
  number: number
  status: string
  payment_status: string
  created_at: string
  total: string
  customer: { email: string; name: string }
  promotional_discount?: { id: number; code: string }
  coupon?: { code: string; type: string; value: string }[]
}

async function safeFetch<T>(url: string, options?: RequestInit): Promise<T[]> {
  try {
    const r = await fetch(url, { headers, ...options })
    return r.ok ? ((await r.json()) as T[]) : []
  } catch {
    return []
  }
}

export const NS = {
  async ordersByEmail(email: string): Promise<NuvemshopOrder[]> {
    return safeFetch<NuvemshopOrder>(
      `${proxy}?action=orders_by_email&email=${encodeURIComponent(email)}`
    )
  },

  async ordersByCoupon(code: string): Promise<NuvemshopOrder[]> {
    return safeFetch<NuvemshopOrder>(
      `${proxy}?action=orders_by_coupon&coupon=${encodeURIComponent(code)}`
    )
  },

  async ordersSince(since: string): Promise<NuvemshopOrder[]> {
    return safeFetch<NuvemshopOrder>(
      `${proxy}?action=orders_since&since=${encodeURIComponent(since)}`
    )
  },

  async checkCoupon(code: string): Promise<{ exists: boolean }> {
    try {
      const r = await fetch(`${proxy}?action=check_coupon&code=${encodeURIComponent(code)}`, { headers })
      return (await r.json()) as { exists: boolean }
    } catch {
      return { exists: false }
    }
  },

  async createCoupon(
    code: string
  ): Promise<{ ok: boolean; duplicate?: boolean }> {
    const descontoPct = Number(import.meta.env['VITE_DESCONTO_PCT'] ?? 0.1)
    try {
      const r = await fetch(`${proxy}?action=create_coupon`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, percentage: descontoPct * 100 }),
      })
      const data = (await r.json()) as { status?: number; ok?: boolean }
      if (data.status === 201 || data.ok) return { ok: true }
      if (data.status === 422) return { ok: false, duplicate: true }
      return { ok: false }
    } catch (e) {
      console.error('createCoupon error:', String(e))
      return { ok: false }
    }
  },
}
