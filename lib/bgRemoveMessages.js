const MESSAGES = {
  invalid_tier: 'Unknown removal tier.',
  not_configured: 'This tier is not set up yet — ask your admin to add an API key.',
  validation_error: 'The image could not be processed. Try a different file.',
  auth_error: 'This tier is temporarily unavailable (provider rejected our credentials).',
  payment_required: 'This tier is out of credits.',
  rate_limited: 'Too many requests — please wait a moment and try again.',
  timeout: 'The provider took too long to respond. Please try again.',
  upstream_error: 'Background removal failed. Please try again.',
}

export function friendlyMessageFor(code) {
  return MESSAGES[code] || null
}
