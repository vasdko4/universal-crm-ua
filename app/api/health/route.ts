import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

const PROBE_TTL_MS = 15_000
let probe: { at: number; ok: boolean } | null = null

/**
 * Health check for hosting platforms / uptime monitors.
 * DB probe is cached so anonymous GETs cannot exhaust the pool (FIX-31).
 */
export async function GET(req: Request) {
  if (await isRateLimited('health', clientIp(req), 60, 60_000)) {
    return NextResponse.json({ status: 'error' }, { status: 429 })
  }

  const now = Date.now()
  if (probe && now - probe.at < PROBE_TTL_MS) {
    return probe.ok
      ? NextResponse.json({ status: 'ok', db: 'up', time: new Date().toISOString() })
      : NextResponse.json(
          { status: 'error', db: 'down', time: new Date().toISOString() },
          { status: 503 },
        )
  }

  try {
    await pool.query('SELECT 1')
    probe = { at: now, ok: true }
    return NextResponse.json({
      status: 'ok',
      db: 'up',
      time: new Date().toISOString(),
    })
  } catch {
    probe = { at: now, ok: false }
    return NextResponse.json(
      { status: 'error', db: 'down', time: new Date().toISOString() },
      { status: 503 },
    )
  }
}
