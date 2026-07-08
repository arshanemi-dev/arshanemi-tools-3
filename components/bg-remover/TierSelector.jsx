'use client'

import { useState } from 'react'
import { Cpu, Server, Sparkles, Crown, Lock, ChevronDown, Check } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

const TIERS = [
  {
    id: 'normal',
    label: 'Normal',
    description: 'Runs in your browser — private, no cost',
    icon: Cpu,
    badge: 'Free',
    badgeVariant: 'success',
  },
  {
    id: 'medium',
    label: 'Medium',
    description: 'Self-hosted AI removal, sharper edges',
    icon: Server,
    badge: 'Low cost',
    badgeVariant: 'accent',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'poof.bg — professional edge detection',
    icon: Sparkles,
    badge: 'Paid',
    badgeVariant: 'premium',
  },
  {
    id: 'pro',
    label: 'Pro',
    description: 'Photoroom — best-in-class studio quality',
    icon: Crown,
    badge: 'Paid',
    badgeVariant: 'premium',
  },
]

// Compact quality dropdown — sits next to the Remove BG button since the
// tier only affects that action, not the background/resize/HD export settings.
export default function TierSelector({ tier, setTier, status }) {
  const [open, setOpen] = useState(false)
  const active = TIERS.find(t => t.id === tier) ?? TIERS[0]
  const ActiveIcon = active.icon

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-semibold rounded-full transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--lt-card)', border: '1px solid var(--lt-divider)', color: 'var(--lt-text-primary)' }}
      >
        <ActiveIcon size={14} style={{ color: 'var(--lt-accent-light)' }} />
        <span className="hidden sm:inline">{active.label}</span>
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-2 z-50 w-72 max-w-[85vw] rounded-[12px] overflow-hidden shadow-2xl"
            style={{ backgroundColor: 'var(--lt-surface)', border: '1px solid var(--lt-divider)' }}
          >
            {TIERS.map(t => {
              const isActive = t.id === tier
              // Server-side tiers (medium/advanced/pro) can be disabled until configured.
              // Never treat "normal" as disabled — it always runs client-side.
              const configured = t.id === 'normal' ? true : status[t.id]
              const disabled = !status.loading && !configured
              const Icon = t.icon

              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => { setTier(t.id); setOpen(false) }}
                  title={disabled ? 'Ask your admin to add an API key for this tier' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  style={{ backgroundColor: isActive ? 'var(--lt-accent-muted)' : 'transparent' }}
                >
                  <Icon size={16} style={{ color: isActive ? 'var(--lt-accent-light)' : 'var(--lt-text-subtle)', flexShrink: 0 }} />

                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--lt-text-primary)' }}>
                      {t.label}
                    </p>
                    <p className="text-[10px] leading-snug mt-0.5" style={{ color: 'var(--lt-text-subtle)' }}>
                      {t.description}
                    </p>
                  </div>

                  {status.loading && t.id !== 'normal' && t.id !== 'medium' ? (
                    <span className="w-12 h-4 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: 'var(--lt-divider)' }} />
                  ) : disabled ? (
                    <span className="flex items-center gap-1 text-[9px] font-medium shrink-0" style={{ color: 'var(--lt-text-subtle)' }}>
                      <Lock size={9} />
                    </span>
                  ) : isActive ? (
                    <Check size={14} style={{ color: 'var(--lt-accent)' }} className="shrink-0" />
                  ) : (
                    <Badge variant={t.badgeVariant} className="shrink-0">{t.badge}</Badge>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
