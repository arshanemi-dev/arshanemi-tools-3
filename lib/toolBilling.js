'use client'
// Cross-app tool billing gate — client for the admin panel's coin-based
// billing. This app never decides or stores a coin amount, and never
// activates/deactivates anything — it fires ONE call to
// POST /api/wallet/deduct with {toolSlug, featureApiIdentifier} and
// displays whatever `error` comes back. Turning a recurring feature
// (feature.fixFeeCoins) on/off happens only from the admin panel's own
// /settings/plan — see components/admin/plan/FeatureActivationPanel.jsx
// there, not anything in this repo.
//
// Same auth transport as tools-1 now: authFetch from lib/tokenStore.js
// (access + refresh token, auto-refreshes on a near-expiry or 401 response)
// rather than a one-shot bearer-only fetch. This app has no separate API-base
// env (unlike tools-1's NEXT_PUBLIC_ADMIN_API_URL) — NEXT_PUBLIC_ADMIN_URL
// already doubles as both the page-link target and the API base here.
//
// Gated on NEXT_PUBLIC_IS_PAID, not NEXT_PUBLIC_IS_CONNECT — IS_CONNECT only
// governs auth/login against the admin panel (see AppShell.jsx), IS_PAID is
// the independent switch for whether billing enforcement runs at all. When
// IS_PAID !== 'true', runBillingGate() short-circuits to 'proceed' with zero
// network calls.

import { authFetch } from '@/lib/tokenStore'

const API_BASE = process.env.NEXT_PUBLIC_ADMIN_URL ?? ''

// Read-only, display-only (e.g. a "Premium" badge shown before the user
// clicks anything) — never part of a billing decision. runBillingGate()
// below never calls this.
async function getMyTool(toolSlug) {
  try {
    const res = await authFetch(`${API_BASE}/api/tools/my`)
    if (!res.ok) return null
    const tools = await res.json()
    return tools.find((t) => t.slug === toolSlug) ?? null
  } catch {
    return null
  }
}

async function deductFeatureCoins({ toolSlug, featureApiIdentifier, idempotencyKey }) {
  const res = await authFetch(`${API_BASE}/api/wallet/deduct`, {
    method: 'POST',
    body: JSON.stringify({ toolSlug, featureApiIdentifier, idempotencyKey }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, ...data }
}

// Reasons BillingGateModal renders a specific, purpose-built modal for.
// Anything else (network hiccup, 401, 500, validation error) collapses to
// the generic 'error' reason with the raw message preserved in data.message.
const KNOWN_REASONS = ['access_denied', 'feature_unavailable', 'activation_required', 'insufficient_coins', 'coins_expired']

// The gate — a single call to /api/wallet/deduct. Every decision (access,
// activation, coin cost) is made server-side; this just fires the request
// and maps whatever comes back. Call this as the first statement after any
// trivial empty-input guard, before real work, at every billable call site.
// On `blocked`, open BillingGateModal with {reason, data} — none of the
// resulting modals let the user self-serve an activation; they're purely
// informational or link out to the admin panel.
export async function runBillingGate({ toolSlug, featureApiIdentifier }) {
  if (process.env.NEXT_PUBLIC_IS_PAID !== 'true') return { status: 'proceed' }

  const result = await deductFeatureCoins({ toolSlug, featureApiIdentifier, idempotencyKey: crypto.randomUUID() })
  if (result.ok) return { status: 'proceed', data: { usageId: result.usageId, remainingCoins: result.remainingCoins } }

  const reason = KNOWN_REASONS.includes(result.error) ? result.error : 'error'
  return {
    status: 'blocked',
    reason,
    data: { ...result, message: result.error, toolSlug, featureApiIdentifier },
  }
}

export { getMyTool, deductFeatureCoins }
