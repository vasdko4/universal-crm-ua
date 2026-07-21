'use server'

import { pool } from '@/lib/db'
import { getShopUser } from '@/lib/session'
import { getProductsByIds, type ShopProduct } from '@/lib/shop/queries'
import { getLocale } from '@/lib/i18n/server'

// Resolve full product data for the given favorite ids. Works for guests too
// (the ids come from the client provider, which reads localStorage when logged out).
export async function getFavoriteProducts(ids: number[]): Promise<ShopProduct[]> {
  const clean = Array.from(
    new Set((ids || []).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)),
  )
  if (clean.length === 0) return []
  const locale = await getLocale()
  return getProductsByIds(clean, locale)
}

// All actions are scoped to the current session user (there is no RLS on the
// Better Auth tables), so every query filters by the authenticated user id.

export async function getFavoriteIds(): Promise<number[]> {
  const user = await getShopUser()
  if (!user) return []
  const { rows } = await pool.query<{ product_id: number }>(
    `SELECT product_id FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.id],
  )
  return rows.map((r) => Number(r.product_id))
}

export async function addFavorite(productId: number): Promise<{ success: boolean }> {
  const user = await getShopUser()
  if (!user) return { success: false }
  if (!Number.isInteger(productId) || productId <= 0) return { success: false }
  await pool.query(
    `INSERT INTO user_favorites (user_id, product_id) VALUES ($1, $2)
     ON CONFLICT (user_id, product_id) DO NOTHING`,
    [user.id, productId],
  )
  return { success: true }
}

export async function removeFavorite(productId: number): Promise<{ success: boolean }> {
  const user = await getShopUser()
  if (!user) return { success: false }
  await pool.query(`DELETE FROM user_favorites WHERE user_id = $1 AND product_id = $2`, [
    user.id,
    productId,
  ])
  return { success: true }
}

// Merge guest favorites (kept in localStorage) into the account on login.
// Returns the full, de-duplicated list of favorite ids afterwards.
export async function mergeFavorites(ids: number[]): Promise<number[]> {
  const user = await getShopUser()
  if (!user) return []
  const clean = Array.from(
    new Set((ids || []).map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)),
  )
  if (clean.length > 0) {
    // Bulk upsert; unnest keeps it to a single round-trip.
    await pool.query(
      `INSERT INTO user_favorites (user_id, product_id)
       SELECT $1, x FROM unnest($2::int[]) AS x
       ON CONFLICT (user_id, product_id) DO NOTHING`,
      [user.id, clean],
    )
  }
  return getFavoriteIds()
}
