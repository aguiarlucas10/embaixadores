/**
 * Upload de arquivos via Edge Function (bright-api) como proxy.
 * Necessário porque a publishable key não suporta Storage API diretamente.
 *
 * A Edge Function recebe o arquivo em base64 e faz o upload usando service_role.
 */

const proxy = `${import.meta.env['VITE_SUPABASE_URL']}/functions/v1/bright-api`
const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${import.meta.env['VITE_SUPABASE_ANON_KEY']}`,
}

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
    const res = await fetch(proxy, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'storage_upload',
        bucket,
        path,
        base64,
        contentType: file.type,
      }),
    })
    const data = await res.json()
    if (data.error) return { error: data.error.message ?? JSON.stringify(data.error) }
    if (data.url) return { url: data.url }
    // Se a Edge Function retornar o path, montar a URL pública
    const publicUrl = `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/object/public/${bucket}/${path}`
    return { url: publicUrl }
  } catch (e) {
    return { error: 'Erro no upload: ' + String(e) }
  }
}
