import 'server-only'
import { db } from '@/lib/db'
import { products } from '@/lib/db/schema'
import { and, eq, ne } from 'drizzle-orm'
import { slugify } from '@/lib/slug'

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
export async function generateUniqueSlug(name: string, fallbackId: number, excludeId?: number): Promise<string> {
  const base = slugify(name) || `product-${fallbackId}`
  let candidate = base
  let n = 2
  for (;;) {
    const clash = await db
      .select({ id: products.id })
      .from(products)
      .where(
        excludeId != null
          ? and(eq(products.slug, candidate), ne(products.id, excludeId))
          : eq(products.slug, candidate),
      )
      .limit(1)
    if (clash.length === 0) return candidate
    candidate = `${base}-${n++}`
  }
}
