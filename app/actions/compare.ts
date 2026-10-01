'use server'

import { pool } from '@/lib/db'
import { getProductsByIds, type ShopProduct } from '@/lib/shop/queries'
import { getLocale } from '@/lib/i18n/server'
import { COMPARE_MAX_ITEMS, cleanCompareIds } from '@/lib/shop/compare'

export type CompareProduct = {
  product: ShopProduct
  characteristics: { name: string; value: string }[]
}

type CharRow = {
  product_id: number
  name: string
  value: string
  sort_order: number | null
}

/**
 * Resolves full product data + characteristics for the compare tray ids.
 * Ordered as requested (the tray's own order), capped at COMPARE_MAX_ITEMS.
 */
export async function getCompareProducts(ids: number[]): Promise<CompareProduct[]> {
  const clean = cleanCompareIds(ids).slice(0, COMPARE_MAX_ITEMS)
  if (clean.length === 0) return []
  const locale = await getLocale()
  const [products, charRows] = await Promise.all([
    getProductsByIds(clean, locale),
    pool
      .query<CharRow>(
        `SELECT product_id, name, value, sort_order
         FROM product_characteristics
         WHERE product_id = ANY($1)
         ORDER BY product_id, sort_order, id`,
        [clean],
      )
      .then((r) => r.rows)
      .catch(() => [] as CharRow[]),
  ])
  const charsById = new Map<number, { name: string; value: string }[]>()
  for (const row of charRows) {
    const list = charsById.get(row.product_id) ?? []
    list.push({ name: row.name, value: row.value })
    charsById.set(row.product_id, list)
  }
  const byId = new Map(products.map((p) => [p.id, p]))
  return clean
    .map((id) => byId.get(id))
    .filter((p): p is ShopProduct => !!p)
    .map((product) => ({ product, characteristics: charsById.get(product.id) ?? [] }))
}
