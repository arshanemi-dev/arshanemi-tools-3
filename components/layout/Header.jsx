'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, LayoutDashboard, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const IS_CONNECT = process.env.NEXT_PUBLIC_IS_CONNECT === 'true'
const ADMIN_URL  = process.env.NEXT_PUBLIC_ADMIN_URL  || ''

const BASE_NAV = [
  { href: '/settings', label: 'Settings', icon: Settings },
]

function handleLogout() {
  localStorage.removeItem('lt_auth_token')
  localStorage.removeItem('lt_auth_user')
  window.location.reload()
}

export default function Header({ authUser }) {
  const pathname = usePathname()

  const nav = IS_CONNECT && ADMIN_URL
    ? [...BASE_NAV, { href: ADMIN_URL, label: 'Admin', icon: LayoutDashboard, external: true }]
    : BASE_NAV

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center border-b px-4" style={{ borderColor: 'var(--lt-divider)', backgroundColor: 'color-mix(in srgb, var(--lt-bg-base) 90%, transparent)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-3 flex-1">
        <Link href="/bg-remover" className="flex items-center gap-2">
          <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--lt-text-primary)' }}>
            ArshaNemi<span style={{ color: 'var(--lt-accent)' }}> MultiImage Background Remover</span>
          </span>
        </Link>
      </div>

      <nav className="flex items-center gap-1">
        {nav.map(({ href, label, icon: Icon, external }) => (
          <Link
            key={href}
            href={href}
            title={label}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-sm transition-colors',
              !external && pathname?.startsWith(href)
                ? 'text-[var(--lt-accent-light)] bg-[var(--lt-accent-muted)]'
                : 'text-[var(--lt-text-subtle)] hover:text-[var(--lt-text-primary)] hover:bg-[var(--lt-card-hover)]'
            )}
          >
            {Icon && <Icon size={14} />}
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}

        {!IS_CONNECT && authUser && (
          <div className="flex items-center gap-2 ml-2 pl-2" style={{ borderLeft: '1px solid var(--lt-divider)' }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] border" style={{ backgroundColor: 'var(--lt-card)', borderColor: 'var(--lt-divider)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: 'var(--lt-accent)' }}>
                {(authUser.name?.[0] ?? authUser.email?.[0] ?? '?').toUpperCase()}
              </div>
              <span className="text-xs font-medium hidden sm:block max-w-[100px] truncate" style={{ color: 'var(--lt-text-primary)' }}>
                {authUser.name || authUser.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-[6px] transition-colors"
              style={{ color: 'var(--lt-text-subtle)' }}
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </nav>
    </header>
  )
}
