import 'server-only'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { slugify } from '@/lib/slug'
import { isUniqueViolation } from '@/lib/db/errors'

/**
 * Bounded retries for slug races. Slug generation is SELECT-then-write:
 * two concurrent admins can both pass the uniqueness check and then collide
 * on the unique index (23505). The caller retries the whole attempt with
 * the next suffix instead of surfacing a 500. 5 attempts cover a realistic
 * burst; beyond that the error is real and should surface.
 *
 * NOTE: a failed INSERT aborts its Postgres transaction, so the retry must
 * wrap the whole attempt (fresh transaction per try) — never retry an
 * insert inside the same transaction.
 */
export const SLUG_RETRY_ATTEMPTS = 5

/**
 * Runs `attempt(slug)`; on a unique-violation retries with an incremented
 * numeric suffix (base-2, base-3, ...). Returns the slug that finally
 * succeeded, or rethrows the last error after SLUG_RETRY_ATTEMPTS tries.
 */
export async function withSlugRetry<T>(
  baseSlug: string,
  attempt: (slug: string) => Promise<T>,
): Promise<{ result: T; slug: string }> {
  let slug = baseSlug
  let lastError: unknown = null
  for (let i = 0; i < SLUG_RETRY_ATTEMPTS; i++) {
    try {
      const result = await attempt(slug)
      return { result, slug }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      lastError = error
      slug = `${baseSlug}-${i + 2}`
    }
  }
  throw lastError
}

// Generates the human-readable `/product/<slug>` URL segment from the
// product name, disambiguating same-name products with a numeric suffix
// (`-2`, `-3`, ...). `excludeId` skips the row being updated so re-saving a
// product without a name change (or re-importing it from Prom.ua) doesn't
// collide with itself. Shared by the manual admin product form
// (app/actions/products.ts) and the Prom.ua importer (app/actions/prom-import.ts)
// so every product — however it was created — ends up with a working,
// unique `/product/<slug>` URL instead of relying on the numeric-id fallback
// (see lib/shop/queries.ts), which 404s/redirect-loops on product detail
// pages once the product's `slug` column is null.
//
// DB-touching, so it lives in its own module (not lib/slug.ts) — that one
// stays a pure/isomorphic helper importable from client components (e.g.
// the admin pages/articles editors), which can't pull in the `pg` driver.
//
// Pass `runner` (a drizzle instance bound to the caller's transaction via
// `dbForClient`) to run the check on the SAME connection as the insert —
// otherwise the check is useless under concurrency (TOCTOU). The unique
// index remains the final arbiter; callers must retry on 23505
// (see withSlugRetry above).
export async function generateUniqueSlug(
  name: string,
  fallbackId: number,
  excludeId?: number,
  runner?: Pick<typeof db, 'select'>,
): Promise<string> {
  const base = slugify(name) || `product-${fallbackId}`
  const tx = runner ?? db
  const rows = await tx
    .select({ slug: products.slug })
    .from(products)
    .where(
      and(
        sql`${products.slug} LIKE ${base + '%'}`,
        excludeId != null ? ne(products.id, excludeId) : undefined,
      ),
    )
  const taken = new Set(rows.map((r) => r.slug).filter((s): s is string => typeof s === 'string'))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}
