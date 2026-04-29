/**
 * Wrappers tipados para as Edge Functions de resgate.
 */
import { supabase } from './supabase'

export type PixKeyType = 'cpf' | 'email' | 'phone' | 'random'

interface FunctionResult<T = Record<string, unknown>> {
  ok: boolean
  error?: string
  message?: string
  data?: T
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<FunctionResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body })
    if (error) {
      const ctx = (error as { context?: { body?: string } }).context
      let parsed: { error?: string; message?: string } | null = null
      if (typeof ctx?.body === 'string') {
        try { parsed = JSON.parse(ctx.body) } catch { /* ignore */ }
      }
      return { ok: false, error: parsed?.error ?? error.name, message: parsed?.message ?? error.message }
    }
    const d = data as { ok?: boolean; error?: string; message?: string }
    return { ok: !!d.ok, error: d.error, message: d.message, data: data as T }
  } catch (e) {
    return { ok: false, error: 'network', message: String(e) }
  }
}

export function requestWithdrawal(input: { valor: number; pix_key: string; pix_key_type: PixKeyType }) {
  return invoke<{ resgate_id: string; valor: number }>('request-withdrawal', input)
}

export function approveWithdrawal(input: { resgate_id: string; notes?: string }) {
  return invoke<{ resgate_id: string }>('approve-withdrawal', input)
}

export function markWithdrawalPaid(input: { resgate_id: string; payment_proof_url?: string; notes?: string }) {
  return invoke<{ resgate_id: string }>('mark-withdrawal-paid', input)
}

export function rejectWithdrawal(input: { resgate_id: string; notes?: string }) {
  return invoke<{ resgate_id: string }>('reject-withdrawal', input)
}
