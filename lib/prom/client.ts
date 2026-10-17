/**
 * Minimal client for the Prom.ua seller API (https://my.prom.ua/api/v1).
 *
 * Auth: personal API token from the Prom seller cabinet
 * (Налаштування → Керування API-ключами), sent as
 * `Authorization: Bearer <token>`.
 *
 * The response shapes are parsed defensively: Prom's docs live behind the
 * seller login, so field names are matched against several known variants
 * and unknown shapes are logged (not crashed on). After the first live
 * sync, check the server logs for `[prom]` lines to tighten the mapping.
 */

const PROM_API_BASE = 'https://my.prom.ua/api/v1'
const PAGE_LIMIT = 100
const REQUEST_TIMEOUT_MS = 15000

export type PromCharacteristic = { name: string; value: string }

export type PromProduct = {
  /** Prom product id — matches `products.prom_id` in our DB. */
  id: number
  name: string
  sku: string | null
  price: number | null
  oldPrice: number | null
  /** Units in stock, when Prom reports it. */
  quantity: number | null
  /** Raw availability marker from Prom (e.g. "available"). */
  presence: string | null
  characteristics: PromCharacteristic[]
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.').replace(/[^\d.\-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const s = v.trim()
    return s ? s : null
  }
  if (typeof v === 'number') return String(v)
  return null
}

function pick<T>(raw: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = raw[k]
    if (v !== undefined && v !== null && v !== '') return v as T
  }
  return undefined
}

/** Normalize one raw product object from the Prom API into PromProduct. */
export function normalizePromProduct(raw: unknown): PromProduct | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = asNumber(pick(r, 'id'))
  if (id === null) return null

  const characteristics: PromCharacteristic[] = []
  const rawChars = pick<unknown>(r, 'characteristics', 'attributes', 'specs', 'params')
  if (Array.isArray(rawChars)) {
    for (const c of rawChars) {
      if (!c || typeof c !== 'object') continue
      const cr = c as Record<string, unknown>
      const name = asString(pick(cr, 'name', 'title', 'key'))
      const value = asString(pick(cr, 'value', 'val'))
      if (name && value) characteristics.push({ name, value })
    }
  } else if (rawChars && typeof rawChars === 'object') {
    // Some APIs return attributes as a { name: value } map.
    for (const [name, value] of Object.entries(rawChars)) {
      const v = asString(value)
      if (name.trim() && v) characteristics.push({ name: name.trim(), value: v })
    }
  }

  return {
    id: Math.trunc(id),
    name: asString(pick(r, 'name', 'title')) ?? '',
    sku: asString(pick(r, 'sku', 'article', 'vendor_code', 'code')),
    price: asNumber(pick(r, 'price')),
    oldPrice: asNumber(pick(r, 'old_price', 'oldPrice', 'discount_price')) ?? null,
    quantity: asNumber(pick(r, 'quantity', 'quantity_in_stock', 'stock', 'count')),
    presence: asString(pick(r, 'presence', 'availability', 'status')),
    characteristics,
  }
}

/** Decide in-stock from Prom's quantity/presence markers. */
export function promInStock(p: PromProduct): boolean {
  if (p.quantity !== null) return p.quantity > 0
  if (p.presence) {
    // Defensive: treat explicit "not available" markers as out of stock.
    if (/not_available|немає|нет в наличии|absent/i.test(p.presence)) return false
  }
  // No quantity info — keep the current storefront state (caller skips).
  return true
}

async function apiGet(token: string, path: string): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${PROM_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: ctrl.signal,
    })
    if (res.status === 401 || res.status === 403) {
      throw new Error('Prom API: невірний або прострочений токен (401/403)')
    }
    if (!res.ok) {
      throw new Error(`Prom API: HTTP ${res.status} на ${path}`)
    }
    return (await res.json()) as unknown
  } finally {
    clearTimeout(timer)
  }
}

function extractList(data: unknown): { items: unknown[]; total: number | null } {
  if (!data || typeof data !== 'object') return { items: [], total: null }
  const d = data as Record<string, unknown>
  const items = d.products ?? d.items ?? d.result ?? d.data
  const total = asNumber(pick(d, 'total', 'count', 'total_count'))
  return { items: Array.isArray(items) ? items : [], total }
}

/**
 * Fetch every product from the Prom catalog (paginated).
 * Logs the raw keys of the first item once, so the field mapping can be
 * verified/tightened after the first live run.
 */
export async function fetchAllPromProducts(token: string): Promise<PromProduct[]> {
  const out: PromProduct[] = []
  const seen = new Set<number>()
  let offset = 0
  let loggedKeys = false
  // Safety: never loop forever if the API ignores `offset` or misreports
  // `total` (a full page every time would otherwise spin endlessly and the
  // sync button would load "forever").
  const MAX_PAGES = 50
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await apiGet(token, `/products/list?limit=${PAGE_LIMIT}&offset=${offset}`)
    const { items, total } = extractList(data)
    if (!loggedKeys && items.length > 0 && typeof items[0] === 'object' && items[0] !== null) {
      loggedKeys = true
      console.log('[prom] products/list first-item keys:', Object.keys(items[0] as object).join(','))
    }
    let fresh = 0
    for (const item of items) {
      const p = normalizePromProduct(item)
      if (!p || seen.has(p.id)) continue
      seen.add(p.id)
      out.push(p)
      fresh++
    }
    console.log(`[prom] products/list page ${page}: ${items.length} items (${fresh} new), total known: ${out.length}`)
    if (items.length === 0) break
    if (fresh === 0) {
      console.warn('[prom] products/list returned only duplicates — stopping pagination (API may ignore offset)')
      break
    }
    if (items.length < PAGE_LIMIT) break
    offset += PAGE_LIMIT
    if (total !== null && offset >= total) break
    // Be gentle with the marketplace API.
    await new Promise((r) => setTimeout(r, 300))
  }
  if (out.length >= MAX_PAGES * PAGE_LIMIT) {
    console.warn(`[prom] hit the ${MAX_PAGES}-page safety cap; catalog may be truncated`)
  }
  return out
}

/**
 * Fetch a single product with full details (used to pull characteristics
 * when the list endpoint doesn't include them).
 */
export async function fetchPromProductDetails(token: string, id: number): Promise<PromProduct | null> {
  const data = await apiGet(token, `/products/${id}`)
  const d = (data as Record<string, unknown> | null) ?? {}
  const inner = (d.product ?? d.item ?? d) as unknown
  return normalizePromProduct(inner)
}
