'use client'

import { Gauge, Cpu, Server, Sparkles, Crown, Lock } from 'lucide-react'
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

export default function TierSelector({ tier, setTier, status }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2" style={{ color: 'var(--lt-text-primary)' }}>
        <Gauge size={15} />
        <span className="text-sm font-bold">Quality</span>
      </div>

      <p className="text-[11px]" style={{ color: 'var(--lt-text-muted)' }}>
        Choose which engine removes the background
      </p>

      <div className="flex flex-col gap-2">
        {TIERS.map(t => {
          const active = tier === t.id
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
              onClick={() => setTier(t.id)}
              title={disabled ? 'Ask your admin to add an API key for this tier' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] border text-left transition-all',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              style={{
                borderColor: active ? 'var(--lt-accent)' : 'var(--lt-divider)',
                backgroundColor: active ? 'var(--lt-accent-muted)' : 'var(--lt-card)',
              }}
            >
              <Icon size={16} style={{ color: active ? 'var(--lt-accent-light)' : 'var(--lt-text-subtle)', flexShrink: 0 }} />

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
                <span className="flex items-center gap-1 text-[10px] font-medium shrink-0" style={{ color: 'var(--lt-text-subtle)' }}>
                  <Lock size={10} />
                  Needs setup
                </span>
              ) : (
                <Badge variant={t.badgeVariant} className="shrink-0">{t.badge}</Badge>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
