/**
 * Helpers para upload e leitura de comprovantes de pagamento (bucket privado).
 *
 * Bucket: `comprovantes`. Policy de RLS aplicada via Storage UI ou SQL:
 *   - INSERT/SELECT só para is_admin()
 */
import { supabase } from './supabase'

const BUCKET = 'comprovantes'

export async function uploadPaymentProof(resgateId: string, file: File): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const safeExt = /^(pdf|jpg|jpeg|png|webp)$/.test(ext) ? ext : 'pdf'
  const path = `${resgateId}/${Date.now()}.${safeExt}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, path }
}

export async function getSignedProofUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}
