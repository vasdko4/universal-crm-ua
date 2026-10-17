/**
 * Prom.ua → engine catalog sync.
 *
 * Matches engine products to Prom products by SKU (normalized: trimmed,
 * case-insensitive), falling back to `products.prom_id`. Per the toggles in
 * Настройки → Prom, updates:
 *  - prices (`price`, plus `old_price` when Prom carries a discount),
 *  - stock (`quantity`, `is_in_stock`, and `stock_status` for default-mode
 *    products — `coming_soon`/`preorder` labels are left alone),
 *  - characteristics: only FILLS missing names and REPLACES empty values;
 *    already-filled characteristics are never overwritten.
 *
 * SKU is the primary key because the catalog import never populated
 * `prom_id` (and the scraper's promId values are not Prom API ids).
 * Engine products without a Prom match are skipped (never deleted);
 * Prom products without an engine match are counted, not imported.
 */

import { pool } from '@/lib/db'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import {
  fetchAllPromProducts,
  fetchPromProductDetails,
  promInStock,
  type PromProduct,
} from './client'

export type PromSyncResult = {
  ok: boolean
  reason?: string
  summary?: string
  pricesUpdated: number
  stockUpdated: number
  characteristicsAdded: number
  unchanged: number
  unmatched: number
  newOnProm: number
  errors: string[]
}

type EngineProduct = {
  id: number
  promId: number | null
  sku: string | null
  price: number
  oldPrice: number | null
  quantity: number
  isInStock: boolean
  stockStatus: string
  availabilityMode: string
}

const IN_STOCK_LABEL = 'В наявності'
const OUT_OF_STOCK_LABEL = 'Немає в наявності'

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Normalize a SKU for matching (Prom and the engine may differ in case). */
function normSku(s: string | null | undefined): string | null {
  if (!s) return null
  const v = s.trim().toUpperCase()
  return v === '' ? null : v
}

type EngineCharacteristic = { id: number; name: string; value: string }

/**
 * Fill missing characteristic names / replace empty values from Prom data.
 * Never overwrites an already-filled value. Returns how many rows changed.
 */
async function applyCharacteristics(
  productId: number,
  existing: EngineCharacteristic[],
  chars: { name: string; value: string }[],
): Promise<number> {
  const byName = new Map(existing.map((c) => [normName(c.name), c]))
  let sortOrder = existing.length
  let added = 0
  for (const ch of chars) {
    const key = normName(ch.name)
    const cur = byName.get(key)
    if (!cur) {
      await pool.query(
        `INSERT INTO product_characteristics (product_id, name, value, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [productId, ch.name.trim(), ch.value.trim(), sortOrder++],
      )
      added++
    } else if (cur.value.trim() === '' && ch.value.trim() !== '') {
      await pool.query(
        `UPDATE product_characteristics SET value = $1, updated_at = NOW() WHERE id = $2`,
        [ch.value.trim(), cur.id],
      )
      // Don't re-fill the same row twice if Prom lists the name twice.
      cur.value = ch.value
      added++
    }
  }
  return added
}

/** Run `fn` over items with at most `limit` concurrent executions. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker)
  await Promise.all(workers)
  return results
}

// How many product-detail requests fly at once. The characteristics leg is
// the slow part of the sync (~160 products on the first run); sequential
// fetching would exceed the ~100s proxy timeout on the manual "Sync now"
// button. 5 concurrent keeps a full sync comfortably under it.
const DETAIL_CONCURRENCY = 5

export async function syncPromProducts(): Promise<PromSyncResult> {
  const result: PromSyncResult = {
    ok: true,
    pricesUpdated: 0,
    stockUpdated: 0,
    characteristicsAdded: 0,
    unchanged: 0,
    unmatched: 0,
    newOnProm: 0,
    errors: [],
  }

  const settings = await getStoreSettingsInternal()
  const cfg = settings.prom
  if (!cfg.enabled) {
    return { ...result, ok: false, reason: 'Інтеграція Prom вимкнена в налаштуваннях' }
  }
  const token = cfg.apiToken?.trim()
  if (!token) {
    return { ...result, ok: false, reason: 'Не вказано API-токен Prom (Налаштування → Prom)' }
  }

  // 1) Pull the Prom catalog.
  let promProducts: PromProduct[]
  try {
    promProducts = await fetchAllPromProducts(token)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ...result, ok: false, reason: msg }
  }
  if (promProducts.length === 0) {
    return { ...result, ok: false, reason: 'Prom API повернув 0 товарів — перевірте токен і каталог' }
  }

  // 2) Load engine products. Match key is the SKU (normalized); prom_id is a
  // fallback for products imported with a real Prom id.
  const { rows } = await pool.query(
    `SELECT id, prom_id, sku, price, old_price, quantity, is_in_stock, stock_status, availability_mode
       FROM products
      WHERE deleted_at IS NULL
        AND (prom_id IS NOT NULL OR (sku IS NOT NULL AND btrim(sku) <> ''))`,
  )
  const byPromId = new Map<number, EngineProduct>()
  const bySku = new Map<string, EngineProduct>()
  const engineProducts: EngineProduct[] = []
  for (const r of rows) {
    const rawPromId = r.prom_id === null ? null : Number(r.prom_id)
    const ep: EngineProduct = {
      id: Number(r.id),
      promId: rawPromId !== null && Number.isFinite(rawPromId) ? rawPromId : null,
      sku: normSku(r.sku === null ? null : String(r.sku)),
      price: Number(r.price) || 0,
      oldPrice: r.old_price === null ? null : Number(r.old_price),
      quantity: Number(r.quantity) || 0,
      isInStock: Boolean(r.is_in_stock),
      stockStatus: String(r.stock_status ?? ''),
      availabilityMode: String(r.availability_mode ?? 'default'),
    }
    engineProducts.push(ep)
    if (ep.promId !== null && !byPromId.has(ep.promId)) byPromId.set(ep.promId, ep)
    if (ep.sku !== null && !bySku.has(ep.sku)) bySku.set(ep.sku, ep)
  }

  // Index Prom products by id and by normalized SKU.
  const promById = new Map<number, PromProduct>()
  const promBySku = new Map<string, PromProduct>()
  for (const pp of promProducts) {
    if (!promById.has(pp.id)) promById.set(pp.id, pp)
    const sku = normSku(pp.sku)
    if (sku !== null && !promBySku.has(sku)) promBySku.set(sku, pp)
  }
  console.log(`[prom] matching: ${engineProducts.length} engine products (${bySku.size} with SKU), ${promProducts.length} Prom products`)

  // 3) Characteristics of matched products (only needed when the toggle is on).
  const charMap = new Map<number, { id: number; name: string; value: string }[]>()
  if (cfg.syncCharacteristics) {
    const ids = engineProducts.map((p) => p.id)
    if (ids.length > 0) {
      const cres = await pool.query(
        `SELECT id, product_id, name, value FROM product_characteristics WHERE product_id = ANY($1)`,
        [ids],
      )
      for (const r of cres.rows) {
        const pid = Number(r.product_id)
        const list = charMap.get(pid) ?? []
        list.push({ id: Number(r.id), name: String(r.name), value: String(r.value ?? '') })
        charMap.set(pid, list)
      }
    }
  }

  // 4) Walk engine products (matched to Prom by prom_id, then SKU):
  // prices + stock are fast and run sequentially.
  // Characteristics are applied from the list payload when present;
  // products whose attributes need a separate detail fetch are queued and
  // pulled concurrently afterwards (phase 4b) to stay under proxy timeouts.
  const changedIds = new Set<number>()
  const matchedPromIds = new Set<number>()
  let matched = 0
  const detailQueue: { ep: EngineProduct; pp: PromProduct }[] = []
  for (const ep of engineProducts) {
    // prom_id first, then SKU.
    let pp = ep.promId !== null ? promById.get(ep.promId) : undefined
    if (!pp && ep.sku !== null) pp = promBySku.get(ep.sku)
    if (!pp) {
      result.unmatched++
      continue
    }
    matchedPromIds.add(pp.id)
    matched++

    // --- Prices ---
    if (cfg.syncPrices && pp.price !== null) {
      const priceChanged = Math.abs(ep.price - pp.price) > 0.005
      const promOld = pp.oldPrice
      const oldChanged =
        (promOld === null && ep.oldPrice !== null) ||
        (promOld !== null && (ep.oldPrice === null || Math.abs(ep.oldPrice - promOld) > 0.005))
      if (priceChanged || oldChanged) {
        await pool.query(
          `UPDATE products SET price = $1, old_price = $2, updated_at = NOW() WHERE id = $3`,
          [pp.price, promOld, ep.id],
        )
        result.pricesUpdated++
        changedIds.add(ep.id)
        ep.price = pp.price
        ep.oldPrice = promOld
      }
    }

    // --- Stock ---
    if (cfg.syncStock) {
      const inStock = promInStock(pp)
      const qty = pp.quantity ?? (inStock ? ep.quantity : 0)
      // Without quantity info from Prom, don't flip the stock state blindly.
      const stockKnown = pp.quantity !== null || pp.presence !== null
      if (stockKnown && (qty !== ep.quantity || inStock !== ep.isInStock)) {
        const newStatus =
          ep.availabilityMode === 'default'
            ? inStock
              ? IN_STOCK_LABEL
              : OUT_OF_STOCK_LABEL
            : ep.stockStatus
        await pool.query(
          `UPDATE products
              SET quantity = $1, is_in_stock = $2, stock_status = $3, updated_at = NOW()
            WHERE id = $4`,
          [qty, inStock, newStatus, ep.id],
        )
        result.stockUpdated++
        changedIds.add(ep.id)
        ep.quantity = qty
        ep.isInStock = inStock
        ep.stockStatus = newStatus
      }
    }

    // --- Characteristics (fill missing / fix empty only) ---
    if (cfg.syncCharacteristics) {
      const existing = charMap.get(ep.id) ?? []
      const needsFix =
        existing.length === 0 || existing.some((c) => c.value.trim() === '')
      if (needsFix) {
        if (pp.characteristics.length > 0) {
          const added = await applyCharacteristics(ep.id, existing, pp.characteristics)
          if (added > 0) {
            result.characteristicsAdded += added
            changedIds.add(ep.id)
          }
        } else {
          // The list endpoint didn't carry attributes — queue a detail fetch.
          detailQueue.push({ ep, pp })
        }
      }
    }
  }

  // 4b) Pull missing characteristics concurrently.
  if (detailQueue.length > 0) {
    console.log(`[prom] fetching characteristics for ${detailQueue.length} products (${DETAIL_CONCURRENCY} concurrent)`)
    await mapWithConcurrency(detailQueue, DETAIL_CONCURRENCY, async ({ ep, pp }) => {
      try {
        const details = await fetchPromProductDetails(token, pp.id)
        const chars = details?.characteristics ?? []
        if (chars.length === 0) return
        const existing = charMap.get(ep.id) ?? []
        const added = await applyCharacteristics(ep.id, existing, chars)
        if (added > 0) {
          result.characteristicsAdded += added
          changedIds.add(ep.id)
        }
      } catch (e) {
        result.errors.push(`характеристики #${pp.id}: ${(e as Error).message}`)
      }
    })
  }

  result.unchanged = matched - changedIds.size

  // Prom products that no engine product matched (counted, never imported).
  for (const pp of promProducts) {
    if (!matchedPromIds.has(pp.id)) result.newOnProm++
  }

  const parts = [
    `ціни: ${result.pricesUpdated}`,
    `наявність: ${result.stockUpdated}`,
    `характеристики: ${result.characteristicsAdded}`,
    `без змін: ${result.unchanged}`,
  ]
  if (result.unmatched > 0) parts.push(`немає в Prom: ${result.unmatched}`)
  if (result.newOnProm > 0) parts.push(`нових в Prom: ${result.newOnProm}`)
  if (result.errors.length > 0) parts.push(`помилок: ${result.errors.length}`)
  result.summary = parts.join('; ')

  // 5) Remember the run in settings (direct SQL — no admin session here).
  try {
    await pool.query(
      `UPDATE store_settings
          SET prom = COALESCE(prom, '{}'::jsonb) || jsonb_build_object('lastSyncAt', $1::text, 'lastSyncSummary', $2::text),
              updated_at = NOW()
        WHERE id = 1`,
      [new Date().toISOString(), result.summary],
    )
  } catch (e) {
    console.error('[prom] failed to persist lastSync:', (e as Error).message)
  }

  return result
}
