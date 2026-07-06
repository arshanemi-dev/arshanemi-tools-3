'use client'

import { useState, useEffect } from 'react'

export function useProviderStatus() {
  const [status, setStatus] = useState({ medium: false, advanced: false, pro: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/bg-remove/status', { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('bad status')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setStatus({ medium: !!data.medium, advanced: !!data.advanced, pro: !!data.pro })
      })
      .catch(() => {
        if (!cancelled) setStatus({ medium: false, advanced: false, pro: false })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { ...status, loading }
}
