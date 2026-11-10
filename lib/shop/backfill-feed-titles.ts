import 'server-only'
import { after } from 'next/server'
import { pool } from '@/lib/db'
import { trimFeedTitle } from '@/lib/shop/feed-title'
import { revalidateStorefront } from '@/lib/shop/cache'

/**
 * Fills the Google Merchant feed title (feed_title_uk/ru) for products
 * that have none yet — trimmed from the product name (see
 * lib/shop/feed-title.ts). Titles edited by hand in admin are never
 * touched. Runs once per server instance on the first storefront request.
 */
const ENSURE_COLUMNS_SQL = `
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "feed_title_uk" varchar(150);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "feed_title_ru" varchar(150);
`

type FeedTitleRow = {
  id: number
  name_uk: string | null
  name_ru: string | null
  feed_title_uk: string | null
  feed_title_ru: string | null
}

let pending: Promise<void> | null = null

async function run(): Promise<void> {
  try {
    await pool.query(ENSURE_COLUMNS_SQL)
    const { rows } = await pool.query<FeedTitleRow>(
      `SELECT id, name_uk, name_ru, feed_title_uk, feed_title_ru FROM products
       WHERE deleted_at IS NULL
         AND (feed_title_uk IS NULL OR feed_title_uk = ''
           OR feed_title_ru IS NULL OR feed_title_ru = '')`,
    )
    for (const row of rows) {
      const uk = row.feed_title_uk?.trim() ? row.feed_title_uk : trimFeedTitle(row.name_uk)
      const ru = row.feed_title_ru?.trim() ? row.feed_title_ru : trimFeedTitle(row.name_ru)
      if (uk === (row.feed_title_uk ?? null) && ru === (row.feed_title_ru ?? null)) continue
      await pool.query('UPDATE products SET feed_title_uk = $2, feed_title_ru = $3 WHERE id = $1', [
        row.id,
        uk,
        ru,
      ])
    }
    // Catalog listings and the Merchant feed are cached; bust them after
    // the one-shot backfill even when nothing changed (columns may have
    // just been created on a previous instance). This module runs inside
    // the shop layout's render, where revalidateTag is unsupported —
    // defer it past the response with `after()`.
    after(() => revalidateStorefront())
  } catch (err) {
    console.error('[backfill-feed-titles]', err instanceof Error ? err.message : err)
  }
}

export function ensureFeedTitlesBackfill(): Promise<void> {
  if (!pending) pending = run()
  return pending
}
