'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart, Loader2 } from 'lucide-react'
import { useFavorites } from '@/lib/shop/favorites-context'
import { getFavoriteProducts } from '@/app/actions/favorites'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import { useSession } from '@/lib/auth-client'
import { ProductCard } from '@/components/shop/product-card'
import { Button } from '@/components/ui/button'
import type { ShopProduct } from '@/lib/shop/queries'

export function FavoritesGrid() {
  const { ids, isReady } = useFavorites()
  const { dict, locale } = useI18n()
  const lp = (p: string) => localizedPath(p, locale)
  const { data: session } = useSession()
  const t = dict.favorites
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Re-fetch product data whenever the set of favorite ids changes. We key on a
  // sorted signature so toggling favorites off removes cards without a full reload.
  const idsKey = [...ids].sort((a, b) => a - b).join(',')
  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    // Genuine data-fetching effect: flip to the loading state right before
    // starting the request (React's own docs show this exact pattern —
    // https://react.dev/learn/synchronizing-with-effects#fetching-data).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getFavoriteProducts(ids)
      .then((res) => {
        if (cancelled) return
        // Preserve the provider's ordering (most recent first).
        const byId = new Map(res.map((p) => [p.id, p]))
        setProducts(ids.map((id) => byId.get(id)).filter((p): p is ShopProduct => !!p))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, isReady])

  return (
    <div className="flex flex-col gap-6">
      {!isReady || loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-20 text-center">
          <Heart className="mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{t.empty}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t.emptyDesc}</p>
          <Button className="mt-6" asChild>
            <Link href={lp('/catalog')}>{t.toCatalog}</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {!session?.user && (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {t.signInHint}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
