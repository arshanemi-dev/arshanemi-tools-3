import { NextResponse } from 'next/server'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || ''

export async function POST(request) {
  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  // ── Connected mode: proxy to external admin panel ──────────────────────────
  if (ADMIN_URL) {
    try {
      const res = await fetch(`${ADMIN_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifier: username, password }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        return NextResponse.json(
          { error: data.error || 'Invalid credentials' },
          { status: res.status || 401 }
        )
      }

      // Same shape as tools-1's own /api/auth/login proxy — accessToken +
      // refreshToken so this app's lib/tokenStore.js can silently refresh
      // instead of hard-logging-out when the access token expires.
      return NextResponse.json({
        accessToken:  data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn:    data.expiresIn,
        user:         data.user,   // { id, name, email, role }
      })
    } catch {
      return NextResponse.json(
        { error: 'Admin API unreachable. Check NEXT_PUBLIC_ADMIN_URL.' },
        { status: 503 }
      )
    }
  }

  // ── Fallback: local env credentials (no ADMIN_URL set) ────────────────────
  // No real refresh token in this mode — a 30-day expiry means the
  // proactive refresh check in tokenStore.js effectively never fires for a
  // normal session, and reusing the same token as its own "refresh token"
  // keeps isLoggedIn() (which checks for a refresh token) working.
  const validUser = process.env.ADMIN_USER || 'admin'
  const validPass = process.env.ADMIN_PASS || 'admin123'

  if (username === validUser && password === validPass) {
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64')
    return NextResponse.json({
      accessToken:  token,
      refreshToken: token,
      expiresIn:    60 * 60 * 24 * 30,
      user: { id: 'local', name: username, email: '', role: 'admin' },
    })
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
}
