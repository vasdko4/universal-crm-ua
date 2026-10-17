/**
 * Prom.ua → engine catalog sync.
 *
 * Matches engine products to Prom products by `products.prom_id` and, per
 * the toggles in Настройки → Prom, updates:
 *  - prices (`price`, plus `old_price` when Prom carries a discount),
 *  - stock (`quantity`, `is_in_stock`, and `stock_status` for default-mode
 *    products — `coming_soon`/`preorder` labels are left alone),
 *  - characteristics: only FILLS missing names and REPLACES empty values;
 *    already-filled characteristics are never overwritten.
 *
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
  promId: number
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

  // 2) Load engine products that came from Prom.
  const { rows } = await pool.query(
    `SELECT id, prom_id, price, old_price, quantity, is_in_stock, stock_status, availability_mode
       FROM products
      WHERE deleted_at IS NULL AND prom_id IS NOT NULL`,
  )
  const engine = new Map<number, EngineProduct>()
  for (const r of rows) {
    const promId = Number(r.prom_id)
    if (!Number.isFinite(promId)) continue
    engine.set(promId, {
      id: Number(r.id),
      promId,
      price: Number(r.price) || 0,
      oldPrice: r.old_price === null ? null : Number(r.old_price),
      quantity: Number(r.quantity) || 0,
      isInStock: Boolean(r.is_in_stock),
      stockStatus: String(r.stock_status ?? ''),
      availabilityMode: String(r.availability_mode ?? 'default'),
    })
  }

  // 3) Characteristics of matched products (only needed when the toggle is on).
  const charMap = new Map<number, { id: number; name: string; value: string }[]>()
  if (cfg.syncCharacteristics) {
    const ids = [...engine.values()].map((p) => p.id)
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

  // 4) Walk Prom products, update matches.
  for (const pp of promProducts) {
    const ep = engine.get(pp.id)
    if (!ep) {
      result.newOnProm++
      continue
    }
    let changed = false

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
        changed = true
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
        changed = true
        ep.quantity = qty
        ep.isInStock = inStock
        ep.stockStatus = newStatus
      }
    }

    // --- Characteristics (fill missing / fix empty only) ---
    if (cfg.syncCharacteristics) {
      let chars = pp.characteristics
      const existing = charMap.get(ep.id) ?? []
      const needsFix =
        existing.length === 0 || existing.some((c) => c.value.trim() === '')
      if (needsFix && chars.length === 0) {
        // The list endpoint didn't carry attributes — pull the product card.
        try {
          const details = await fetchPromProductDetails(token, pp.id)
          if (details) chars = details.characteristics
          await new Promise((r) => setTimeout(r, 250))
        } catch (e) {
          result.errors.push(`характеристики #${pp.id}: ${(e as Error).message}`)
        }
      }
      if (needsFix && chars.length > 0) {
        const byName = new Map(existing.map((c) => [normName(c.name), c]))
        let sortOrder = existing.length
        for (const ch of chars) {
          const key = normName(ch.name)
          const cur = byName.get(key)
          if (!cur) {
            await pool.query(
              `INSERT INTO product_characteristics (product_id, name, value, sort_order)
               VALUES ($1, $2, $3, $4)`,
              [ep.id, ch.name.trim(), ch.value.trim(), sortOrder++],
            )
            result.characteristicsAdded++
            changed = true
          } else if (cur.value.trim() === '' && ch.value.trim() !== '') {
            await pool.query(
              `UPDATE product_characteristics SET value = $1, updated_at = NOW() WHERE id = $2`,
              [ch.value.trim(), cur.id],
            )
            result.characteristicsAdded++
            changed = true
          }
        }
      }
    }

    if (!changed) result.unchanged++
  }

  // Engine products that Prom no longer lists (deleted/hidden there).
  const promIds = new Set(promProducts.map((p) => p.id))
  for (const promId of engine.keys()) {
    if (!promIds.has(promId)) result.unmatched++
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
