'use client'

import { useEffect, useState } from 'react'
import { ProductCard } from '@/components/shop/product-card'
import { getRecentlyViewedProducts } from '@/app/actions/recently-viewed'
import { recordProductView, getRecentlyViewedIds } from '@/lib/shop/recently-viewed'
import { useI18n } from '@/lib/i18n/client'
import type { ShopProduct } from '@/lib/shop/queries'

// Mounted once on the product page. Records the current product into the
// visitor's localStorage history, then loads full product data for the rest
// of that history (excluding the product currently being viewed) and renders
// it as a "Recently viewed" grid — same card component/style as "Related
// products". Renders nothing until there's at least one other item to show,
// so it never leaves an empty section on someone's very first page view.
export function RecentlyViewed({ productId }: { productId: number }) {
  const { dict } = useI18n()
  const [products, setProducts] = useState<ShopProduct[] | null>(null)

  useEffect(() => {
    recordProductView(productId)
    const ids = getRecentlyViewedIds(productId)
    let cancelled = false
    getRecentlyViewedProducts(ids)
      .then((data) => {
        if (!cancelled) setProducts(data)
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  if (!products || products.length === 0) return null

  return (
    <section className="mt-14">
      <h2 className="mb-5 text-2xl font-bold tracking-tight text-foreground">{dict.product.recentlyViewed}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  )
}
