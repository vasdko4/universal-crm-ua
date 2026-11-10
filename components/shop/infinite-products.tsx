'use client'

import { useCallback, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/shop/product-card'
import { loadMoreProducts } from '@/app/actions/catalog'
import type { ShopProduct, CatalogParams } from '@/lib/shop/queries'
import { useI18n } from '@/lib/i18n/client'

/**
 * Renders a product grid with a "Show more" button. The first page is rendered
 * on the server and passed as `initialItems`; subsequent pages are fetched via
 * the `loadMoreProducts` server action when the user clicks the button.
 *
 * Remount this component (via a `key` derived from the active filters) whenever
 * sort/search/filter params change so it restarts from a clean first page.
 */
export function InfiniteProducts({
  initialItems,
  total,
  params,
  gridClassName = 'product-grid',
  priorityInitialImages = true,
}: {
  initialItems: ShopProduct[]
  total: number
  // Query params WITHOUT `page` — the component manages paging internally.
  params: CatalogParams
  /** Full grid class list, e.g. Tailwind 'grid grid-cols-2 ... xl:grid-cols-7'. */
  gridClassName?: string
  /**
   * Give the first visible catalogue row a high image-fetch priority. Pages
   * that render this grid below another LCP candidate (the homepage) must
   * turn this off so below-the-fold cards do not compete for bandwidth.
   */
  priorityInitialImages?: boolean
}) {
  const { dict } = useI18n()
  const perPage = params.perPage ?? 24
  const [items, setItems] = useState<ShopProduct[]>(initialItems)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(initialItems.length >= total)
  const busyRef = useRef(false)

  const label = dict.common.showMore

  const loadMore = useCallback(async () => {
    if (busyRef.current || done) return
    busyRef.current = true
    setLoading(true)
    const next = page + 1
    try {
      const res = await loadMoreProducts({ ...params, page: next, perPage })
      setItems((prev) => {
        const merged = [...prev, ...res.items]
        if (res.items.length === 0 || merged.length >= res.total) setDone(true)
        return merged
      })
      setPage(next)
    } finally {
      setLoading(false)
      busyRef.current = false
    }
  }, [page, params, perPage, done])

  return (
    <div className="space-y-6">
      <div className={gridClassName}>
        {items.map((p, i) => (
          // On catalogue pages the first row can be the LCP. The homepage
          // passes false because its hero is the LCP and this grid is far
          // below the fold.
          <ProductCard key={p.id} product={p} priority={priorityInitialImages && i < 2} />
        ))}
      </div>

      {!done && (
        <div className="flex justify-center py-4">
          <Button variant="outline" size="lg" onClick={loadMore} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {label}
          </Button>
        </div>
      )}
    </div>
  )
}
