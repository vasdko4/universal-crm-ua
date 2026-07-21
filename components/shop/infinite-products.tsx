'use client'

import { useCallback, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/shop/product-card'
import { loadMoreProducts } from '@/app/actions/catalog'
import type { ShopProduct, CatalogParams } from '@/lib/shop/queries'

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
}: {
  initialItems: ShopProduct[]
  total: number
  // Query params WITHOUT `page` — the component manages paging internally.
  params: CatalogParams
}) {
  const perPage = params.perPage ?? 12
  const [items, setItems] = useState<ShopProduct[]>(initialItems)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(initialItems.length >= total)
  const busyRef = useRef(false)

  const label = params.locale === 'ru' ? 'Показать ещё' : 'Показати ще'

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
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
