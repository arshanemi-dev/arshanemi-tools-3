import { ProviderError } from './errors'
import { postMultipart, readErrorMessage } from './http'

const POOF_API_URL = 'https://api.poof.bg/v1/remove'

export function isConfigured() {
  return !!process.env.POOF_API_KEY
}

export async function removeBackground(blob, filename) {
  const apiKey = process.env.POOF_API_KEY
  if (!apiKey) {
    throw new ProviderError('not_configured', 'Advanced tier is not configured', 503)
  }

  const res = await postMultipart({
    url: POOF_API_URL,
    fieldName: 'image_file',
    blob,
    filename,
    headers: { 'x-api-key': apiKey },
  })

  if (!res.ok) {
    const message = await readErrorMessage(res)
    if (res.status === 400) throw new ProviderError('validation_error', message, 400)
    if (res.status === 401) throw new ProviderError('auth_error', message, 502)
    if (res.status === 402) throw new ProviderError('payment_required', message, 402)
    if (res.status === 429) throw new ProviderError('rate_limited', message, 429)
    throw new ProviderError('upstream_error', message, 502)
  }

  const contentType = res.headers.get('content-type') || 'image/png'
  return { blob: await res.blob(), contentType }
}
