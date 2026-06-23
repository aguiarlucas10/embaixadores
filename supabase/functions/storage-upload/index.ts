/**
 * POST /functions/v1/storage-upload
 * Body: { bucket: 'assets'|'banners', path: string, base64: string, contentType: string }
 *
 * Substitui a action `storage_upload` da `bright-api` antiga (função removida
 * do Supabase). Usa service_role pois os buckets de banner não têm policy de
 * INSERT via RLS para o publishable key.
 */
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase-admin.ts'
import { requireAdmin } from '../_shared/auth-guard.ts'

const ALLOWED_BUCKETS = ['assets', 'banners']

interface Body {
  bucket?: string
  path?: string
  base64?: string
  contentType?: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, { status: 405 })
  }

  const admin = await requireAdmin(req)
  if (!admin) return jsonResponse({ ok: false, error: 'forbidden' }, { status: 403 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const { bucket, path, base64, contentType } = body
  if (!bucket || !path || !base64 || !contentType) {
    return jsonResponse({ ok: false, error: 'missing_fields' }, { status: 400 })
  }
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return jsonResponse({ ok: false, error: 'invalid_bucket' }, { status: 400 })
  }
  if (path.includes('..')) {
    return jsonResponse({ ok: false, error: 'invalid_path' }, { status: 400 })
  }

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_base64' }, { status: 400 })
  }

  const supa = adminClient()
  const { error } = await supa.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
  })
  if (error) {
    return jsonResponse({ ok: false, error: 'upload_failed', message: error.message }, { status: 500 })
  }

  const { data } = supa.storage.from(bucket).getPublicUrl(path)
  return jsonResponse({ ok: true, url: data.publicUrl })
})
