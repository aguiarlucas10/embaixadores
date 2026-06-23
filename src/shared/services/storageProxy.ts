/**
 * Upload de banners via Edge Function `storage-upload` (service_role).
 * Necessário porque os buckets 'assets'/'banners' não têm policy de INSERT
 * via RLS para o publishable key.
 */
import { supabase } from './supabase'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove o prefixo "data:image/png;base64,"
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadBanner(
  file: File,
  bucket: string,
  path: string
): Promise<{ url: string } | { error: string }> {
  try {
    const base64 = await fileToBase64(file)
    const { data, error } = await supabase.functions.invoke('storage-upload', {
      body: { bucket, path, base64, contentType: file.type },
    })
    if (error) {
      const ctx = (error as { context?: { body?: string } }).context
      let parsed: { error?: string; message?: string } | null = null
      if (typeof ctx?.body === 'string') {
        try { parsed = JSON.parse(ctx.body) } catch { /* ignore */ }
      }
      return { error: parsed?.message ?? parsed?.error ?? error.message }
    }
    const d = data as { ok?: boolean; url?: string; message?: string; error?: string }
    if (!d.ok || !d.url) return { error: d.message ?? d.error ?? 'Erro desconhecido no upload' }
    return { url: d.url }
  } catch (e) {
    return { error: 'Erro no upload: ' + String(e) }
  }
}
