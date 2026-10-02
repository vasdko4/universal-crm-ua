'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2, Scale, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCompare } from '@/lib/shop/compare-context'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import { getCompareProducts, type CompareProduct } from '@/app/actions/compare'
import { variantLabel } from '@/components/shop/product-purchase-panel'
import { buildSpecRows, diffRowFlags, type CompareSpecRow } from '@/lib/shop/compare'
import { isProxiedMedia } from '@/lib/shop/own-image-url'
import { cn } from '@/lib/utils'

export function CompareGrid() {
  const { ids, isReady, remove } = useCompare()
  const { add } = useCart()
  const router = useRouter()
  const { dict, locale } = useI18n()
  const t = dict.compare
  const lp = (p: string) => localizedPath(p, locale)
  const [items, setItems] = useState<CompareProduct[]>([])
  const [loading, setLoading] = useState(true)

  const idsKey = [...ids].sort((a, b) => a - b).join(',')
  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getCompareProducts(ids)
      .then((res) => {
        if (cancelled) return
        // Preserve the tray order (most recently added last).
        const byId = new Map(res.map((p) => [p.product.id, p]))
        const found = ids.map((id) => byId.get(id)).filter((p): p is CompareProduct => !!p)
        setItems(found)
        // Drop ids of deleted products from the tray so the header badge and
        // the table agree. remove() flows through the context's single write
        // path (writeCompareIds), keeping state and localStorage in sync.
        if (found.length !== ids.length) {
          const foundIds = new Set(found.map((p) => p.product.id))
          ids.filter((id) => !foundIds.has(id)).forEach(remove)
        }
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, isReady])

  const rows: { row: CompareSpecRow; differs: boolean }[] = useMemo(() => {
    if (items.length === 0) return []
    const specRows = buildSpecRows(
      items.map((i) => ({ characteristics: i.characteristics, options: i.product.options })),
    )
    const all: CompareSpecRow[] = [
      { name: t.sku, values: items.map((i) => i.product.sku) },
      ...specRows,
    ]
    const flags = diffRowFlags(all)
    return all.map((row, idx) => ({ row, differs: flags[idx] }))
  }, [items, t.sku])

  function handleAdd(item: CompareProduct) {
    const { product } = item
    if (!product.inStock) return
    const needsSize =
      product.needsSizeChoice ??
      (product.variantsEnabled && product.options.some((o) => o.values.length > 1) && product.variants.length > 1)
    if (needsSize) {
      router.push(lp(`/product/${product.slug}`))
      return
    }
    // Single-variant product: add the variant itself (id, price, stock) —
    // never the base product row at the aggregate price.
    const variant = product.variants.length === 1 ? product.variants[0] : null
    add(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: variant?.price ?? product.price,
        image: variant?.image ?? product.image,
        maxQuantity: variant?.quantity ?? product.quantity,
        variantId: variant?.id ?? null,
        variantLabel: variant ? variantLabel(variant) : null,
      },
      1,
    )
    toast.success(dict.product.addedToCart, { description: product.name })
  }

  if (!isReady || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-20 text-center">
        <Scale className="mb-4 size-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">{t.empty}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t.emptyDesc}</p>
        <Button className="mt-6" asChild>
          <Link href={lp('/catalog')}>{t.toCatalog}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card" data-testid="compare-table">
      <table className="w-full min-w-[680px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            {/* Label column stays pinned while the product columns scroll. */}
            <th className="sticky left-0 z-10 w-40 bg-card p-3 align-bottom text-left text-xs font-medium uppercase tracking-wide text-muted-foreground" />
            {items.map((item) => {
              const { product } = item
              const href = lp(`/product/${product.slug}`)
              return (
                <th key={product.id} className="min-w-52 max-w-64 p-3 align-top font-normal">
                  <div className="relative flex flex-col gap-2 text-left">
                    <button
                      type="button"
                      onClick={() => remove(product.id)}
                      aria-label={t.remove}
                      data-testid="compare-remove"
                      className="absolute -right-1 -top-1 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                    <Link href={href} className="relative mx-auto block aspect-square w-full max-w-40 overflow-hidden rounded-xl bg-white dark:bg-neutral-900">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="200px"
                          className="object-contain p-2"
                          unoptimized={isProxiedMedia(product.image)}
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          {dict.product.noPhoto}
                        </span>
                      )}
                    </Link>
                    <Link href={href} className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-foreground hover:text-primary">
                      {product.name}
                    </Link>
                    <span className="text-lg font-bold text-foreground">
                      {formatPrice(product.price, product.currency, locale)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleAdd(item)}
                      disabled={!product.inStock}
                      data-testid="compare-add-to-cart"
                      className="h-9 w-full rounded-lg text-sm font-semibold"
                    >
                      <ShoppingCart className="size-3.5" />
                      <span>{dict.product.addToCart}</span>
                    </Button>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, differs }) => (
            <tr
              key={row.name}
              data-testid="compare-spec-row"
              data-differs={differs}
              className={cn(
                'border-b border-border/60 last:border-0',
                differs && 'bg-warning/10',
              )}
            >
              <th
                className={cn(
                  'sticky left-0 z-10 w-40 bg-card p-3 text-left align-top text-xs font-medium text-muted-foreground',
                  differs && 'bg-warning/10',
                )}
              >
                {row.name}
              </th>
              {row.values.map((value, vi) => (
                <td key={vi} className="min-w-52 max-w-64 p-3 align-top text-sm text-foreground">
                  {value?.trim() ? value : <span className="text-muted-foreground">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
