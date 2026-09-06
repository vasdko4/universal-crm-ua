import { NextResponse } from 'next/server'

export function ok(data: unknown, meta?: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}) })
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

/** Positive integer path/query id. Rejects '', 'abc', '0', negatives, decimals. */
export function parsePositiveInt(value: string | null | undefined): number | null {
  if (value == null || value === '') return null
  if (!/^\d+$/.test(value)) return null
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 1) return null
  return n
}

/** Strip NUL / other C0 controls so Postgres LIKE/ilike cannot 500. */
export function sanitizeSearch(raw: string): string {
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 200)
}

export function parseListParams(url: string) {
  const { searchParams } = new URL(url)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '10') || 10))
  const search = sanitizeSearch(searchParams.get('search') ?? searchParams.get('q') ?? '')
  const status = searchParams.get('status') ?? 'all'
  return { page, pageSize, search, status, searchParams }
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}
