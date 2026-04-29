/**
 * Cliente das Edge Functions Nuvemshop com erros estruturados.
 *
 * Substitui o `nuvemshopApi.ts` antigo (que silenciava erros via `safeFetch`,
 * causa raiz dos bugs B1 — cadastro não validava — e B2 — todos cupons
 * "indisponíveis"). Aqui cada chamada retorna `{ok: bool, ...}` e a UI pode
 * traduzir cada estado.
 */
import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env['VITE_SUPABASE_URL'] as string
const ANON = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${ANON}`,
  apikey: ANON,
}

export type CouponState = 'available' | 'taken' | 'error_auth' | 'error_other'

export interface OrdersByEmailResult {
  ok: boolean
  found: boolean
  paid: number
  total: number
  errorKind?: string
  errorMessage?: string
}

export async function ordersByEmail(email: string): Promise<OrdersByEmailResult> {
  const url = `${SUPABASE_URL}/functions/v1/nuvemshop-orders-by-email?email=${encodeURIComponent(email)}`
  try {
    const r = await fetch(url, { headers })
    const data = await r.json() as {
      ok: boolean; found?: boolean; paid?: number; total?: number; error?: string; message?: string
    }
    if (!data.ok) {
      return {
        ok: false,
        found: false,
        paid: 0,
        total: 0,
        errorKind: data.error,
        errorMessage: data.message,
      }
    }
    return {
      ok: true,
      found: !!data.found,
      paid: data.paid ?? 0,
      total: data.total ?? 0,
    }
  } catch (e) {
    return { ok: false, found: false, paid: 0, total: 0, errorKind: 'network', errorMessage: String(e) }
  }
}

export async function checkCoupon(code: string): Promise<{ ok: boolean; state: CouponState; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('nuvemshop-coupons', {
      body: { action: 'check', code },
    })
    if (error) return { ok: false, state: 'error_other', message: error.message }
    const d = data as { ok: boolean; state?: CouponState; message?: string }
    return { ok: !!d.ok, state: d.state ?? 'error_other', message: d.message }
  } catch (e) {
    return { ok: false, state: 'error_other', message: String(e) }
  }
}

export async function createCoupon(
  code: string,
  percentage: number,
): Promise<{ ok: boolean; state: 'created' | 'taken' | 'error_auth' | 'error_other'; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('nuvemshop-coupons', {
      body: { action: 'create', code, percentage },
    })
    if (error) {
      const ctx = (error as { context?: unknown }).context
      const body = (typeof ctx === 'object' && ctx !== null && 'body' in ctx ? (ctx as { body: string }).body : null)
      let parsed: { state?: 'taken' | 'error_auth' | 'error_other'; message?: string } | null = null
      if (typeof body === 'string') {
        try { parsed = JSON.parse(body) } catch { /* ignore */ }
      }
      return { ok: false, state: parsed?.state ?? 'error_other', message: parsed?.message ?? error.message }
    }
    const d = data as { ok: boolean; state?: 'created' | 'taken' | 'error_auth' | 'error_other'; message?: string }
    return { ok: !!d.ok, state: d.state ?? 'error_other', message: d.message }
  } catch (e) {
    return { ok: false, state: 'error_other', message: String(e) }
  }
}
