import { ProviderError } from './errors'
import { postMultipart, readErrorMessage } from './http'

const REMBG_API_URL = process.env.REMBG_API_URL ?? 'http://187.127.189.252:7000'

export function isConfigured() {
  return !!REMBG_API_URL
}

export async function removeBackground(blob, filename) {
  if (!REMBG_API_URL) {
    throw new ProviderError('not_configured', 'Medium tier is not configured', 503)
  }

  const res = await postMultipart({
    url: `${REMBG_API_URL}/api/remove`,
    fieldName: 'file',
    blob,
    filename,
  })

  if (!res.ok) {
    const message = await readErrorMessage(res)
    if (res.status === 400) throw new ProviderError('validation_error', message, 400)
    throw new ProviderError('upstream_error', message, 502)
  }

  const contentType = res.headers.get('content-type') || 'image/png'
  return { blob: await res.blob(), contentType }
}
