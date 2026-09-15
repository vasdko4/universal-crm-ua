import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

class SentryVercelDeployError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SentryVercelDeployError'
  }
}

export function GET() {
  throw new SentryVercelDeployError('Thrown by Next.js on Vercel production, not the ingest API')
  return NextResponse.json({ ok: false })
}
