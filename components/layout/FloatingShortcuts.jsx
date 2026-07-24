'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { clearAuthTokens } from '@/lib/tokenStore'

const NAV_ITEMS = [
  { href: '/settings', label: 'Settings', icon: Settings },
]

function ShortcutBtn({ isActive, icon: Icon, label }) {
  return (
    <span
      title={label}
      className={cn(
        'group relative flex items-center justify-center w-11 h-11 rounded-[12px] border shadow-lg transition-all duration-150',
        isActive
          ? 'border-[var(--lt-accent)] text-white shadow-[0_4px_16px_0_var(--lt-accent)]/40'
          : 'border-[var(--lt-divider)] text-[var(--lt-text-subtle)] hover:border-[var(--lt-divider-light)] hover:text-[var(--lt-text-primary)] hover:shadow-xl'
      )}
      style={{ backgroundColor: isActive ? 'var(--lt-accent)' : 'var(--lt-card)' }}
    >
      {Icon && <Icon size={18} />}
      <span className="pointer-events-none absolute right-full mr-2.5 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-[7px] border px-2.5 py-1.5 text-[11px] font-semibold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ backgroundColor: 'var(--lt-card)', borderColor: 'var(--lt-divider)', color: 'var(--lt-text-primary)' }}>
        {label}
      </span>
    </span>
  )
}

function handleLogout() {
  clearAuthTokens()
  window.location.reload()
}

export default function FloatingShortcuts() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col items-center gap-2">
      {NAV_ITEMS.map(({ href, label, icon }) => (
        <Link key={href} href={href}>
          <ShortcutBtn isActive={pathname?.startsWith(href)} icon={icon} label={label} />
        </Link>
      ))}
      <button onClick={handleLogout}>
        <ShortcutBtn label="Logout" icon={LogOut} isActive={false} />
      </button>
    </div>
  )
}
