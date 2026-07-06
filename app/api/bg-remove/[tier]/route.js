import { NextResponse } from 'next/server'
import { PROVIDERS } from '@/lib/bg-providers'
import { ProviderError } from '@/lib/bg-providers/errors'

export const runtime = 'nodejs'

export async function POST(request, { params }) {
  const { tier } = await params
  const provider = PROVIDERS[tier]

  if (!provider) {
    return NextResponse.json({ error: 'Unknown tier', code: 'invalid_tier' }, { status: 400 })
  }
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: 'This tier is not configured', code: 'not_configured' }, { status: 503 })
  }

  const form = await request.formData()
  const file = form.get('image')
  if (!file) {
    return NextResponse.json({ error: 'Missing image', code: 'validation_error' }, { status: 400 })
  }

  try {
    const { blob, contentType } = await provider.removeBackground(file, file.name || 'image.png')
    return new NextResponse(blob, { status: 200, headers: { 'Content-Type': contentType } })
  } catch (err) {
    if (err instanceof ProviderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    }
    return NextResponse.json({ error: 'Unexpected server error', code: 'upstream_error' }, { status: 500 })
  }
}
