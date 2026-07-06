import { ProviderError } from './errors'
import { postMultipart, readErrorMessage } from './http'

const PHOTOROOM_API_URL = 'https://sdk.photoroom.com/v1/segment'

export function isConfigured() {
  return !!process.env.PHOTOROOM_API_KEY
}

export async function removeBackground(blob, filename) {
  const apiKey = process.env.PHOTOROOM_API_KEY
  if (!apiKey) {
    throw new ProviderError('not_configured', 'Pro tier is not configured', 503)
  }

  const res = await postMultipart({
    url: PHOTOROOM_API_URL,
    fieldName: 'image_file',
    blob,
    filename,
    headers: { 'x-api-key': apiKey },
  })

  if (!res.ok) {
    const message = await readErrorMessage(res)
    if (res.status === 400) throw new ProviderError('validation_error', message, 400)
    if (res.status === 402) throw new ProviderError('payment_required', message, 402)
    if (res.status === 403) throw new ProviderError('auth_error', message, 502)
    if (res.status === 429) throw new ProviderError('rate_limited', message, 429)
    throw new ProviderError('upstream_error', message, 502)
  }

  const contentType = res.headers.get('content-type') || 'image/png'
  if (!contentType.startsWith('image/')) {
    throw new ProviderError('upstream_error', 'Unexpected response from Photoroom', 502)
  }

  return { blob: await res.blob(), contentType }
}
