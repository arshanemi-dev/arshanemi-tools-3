// Central declaration of this app's billing identifiers, for use with
// lib/toolBilling.js's runBillingGate({ toolSlug, featureApiIdentifier }).
//
// Keep in sync with the admin panel repo's data/tools.js `bg-remover`
// entry — any apiIdentifier used here must exist there with a matching
// coinCost/fixFeeCoins, or runBillingGate() will treat it as unavailable.
//
// Usage at a call site:
//   import { TOOL_SLUG, featureForTier } from '@/lib/toolFeatures'
//   const gate = await runBillingGate({ toolSlug: TOOL_SLUG, featureApiIdentifier: featureForTier(tier) })

export const TOOL_SLUG = 'bg-remover'

// Server-side paid tiers only. 'normal' runs client-side (in-browser WASM
// model) and is never billed — never call featureForTier('normal').
export const FEATURES = {
  MEDIUM: 'bg-remove-medium',
  ADVANCED: 'bg-remove-advanced',
  PRO: 'bg-remove-pro',
}

export function featureForTier(tier) {
  return `bg-remove-${tier}`
}
