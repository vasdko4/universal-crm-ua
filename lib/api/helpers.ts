import { NextResponse } from 'next/server'

export function ok(data: unknown, meta?: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}) })
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export function parseListParams(url: string) {
  const { searchParams } = new URL(url)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? '10') || 10))
  const search = searchParams.get('search') ?? searchParams.get('q') ?? ''
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
