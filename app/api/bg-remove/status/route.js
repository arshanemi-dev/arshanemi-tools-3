import { NextResponse } from 'next/server'
import { getStatus } from '@/lib/bg-providers'

export async function GET() {
  return NextResponse.json(getStatus())
}
