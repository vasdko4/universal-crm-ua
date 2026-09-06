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

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 10

export function parseListParams(url: string) {
  const { searchParams } = new URL(url)
  let error: string | null = null

  const pageRaw = searchParams.get('page')
  let page = 1
  if (pageRaw != null && pageRaw !== '') {
    const parsed = parsePositiveInt(pageRaw)
    if (parsed == null) error = 'Некорректный page'
    else page = parsed
  }

  const pageSizeRaw = searchParams.get('pageSize')
  let pageSize = DEFAULT_PAGE_SIZE
  if (pageSizeRaw != null && pageSizeRaw !== '') {
    const parsed = parsePositiveInt(pageSizeRaw)
    if (parsed == null || parsed > MAX_PAGE_SIZE) error = error ?? 'Некорректный pageSize'
    else pageSize = parsed
  }

  const search = sanitizeSearch(searchParams.get('search') ?? searchParams.get('q') ?? '')
  const status = searchParams.get('status') ?? 'all'
  return { page, pageSize, search, status, searchParams, error }
}

/**
 * Parse a JSON body without using Request.json().
 * Next.js App Router can surface SyntaxError from json() as an uncaught 500
 * ("Unexpected token...") before a route-level try/catch runs.
 */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    const raw = await req.text()
    if (!raw.trim()) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
