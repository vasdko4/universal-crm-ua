import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Health check for hosting platforms / uptime monitors.
 * Returns 200 when the app and the database are reachable, 503 otherwise.
 */
export async function GET() {
  try {
    await pool.query('SELECT 1')
    return NextResponse.json({ status: 'ok', db: 'up', time: new Date().toISOString() })
  } catch {
    return NextResponse.json(
      { status: 'error', db: 'down', time: new Date().toISOString() },
      { status: 503 },
    )
  }
}
