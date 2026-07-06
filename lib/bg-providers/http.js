import { ProviderError } from './errors'

// Shared multipart POST helper — builds the form, applies a timeout, and
// normalizes network-level failures. Each provider still interprets the
// response status itself, since success/error status codes differ per API.
export async function postMultipart({ url, fieldName, blob, filename, headers = {}, extraFields = {}, timeoutMs = 30000 }) {
  const form = new FormData()
  form.append(fieldName, blob, filename)
  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined && value !== null) form.append(key, String(value))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { method: 'POST', headers, body: form, signal: controller.signal })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ProviderError('timeout', 'The background-removal provider took too long to respond', 504)
    }
    throw new ProviderError('upstream_error', 'Could not reach the background-removal provider', 502)
  } finally {
    clearTimeout(timer)
  }
}

// Defensive error-body reader: JSON -> text -> statusText fallback chain,
// since exact error schemas aren't guaranteed to match documentation.
export async function readErrorMessage(res) {
  try {
    const data = await res.clone().json()
    return data?.error || data?.message || JSON.stringify(data)
  } catch {
    try {
      const text = await res.clone().text()
      if (text) return text
    } catch {}
    return res.statusText || `HTTP ${res.status}`
  }
}
