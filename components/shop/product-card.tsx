'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Check, Ruler } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import type { ShopProduct } from '@/lib/shop/queries'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import { fillTemplate } from '@/lib/i18n/dictionaries'
import { pluralize } from '@/lib/i18n/plural'
import { FavoriteButton } from '@/components/shop/favorite-button'
import { cn } from '@/lib/utils'

export function ProductCard({ product }: { product: ShopProduct }) {
  const { add } = useCart()
  const router = useRouter()
  const { dict, locale } = useI18n()
  const href = localizedPath(`/product/${product.slug}`, locale)
  const [added, setAdded] = useState(false)
  const needsSize = (product.sizes?.length ?? 0) > 0

  const primary = product.image
  const hoverImage = useMemo(() => {
    const extras = (product.images ?? []).filter((url) => url && url !== primary)
    return extras[0] ?? null
  }, [product.images, primary])

  // The name is clamped to 2 lines with an ellipsis on every screen size so
  // cards keep a consistent height in the grid; from `sm:` up (where hover
  // is available) a flyout reveals the full name on hover when it was cut
  // off. On touch devices the shopper can just open the product page.
  const nameRef = useRef<HTMLAnchorElement>(null)
  const [truncated, setTruncated] = useState(false)
  useEffect(() => {
    const el = nameRef.current
    if (!el) return
    const check = () => setTruncated(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [product.name])

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0

  function handleAdd() {
    if (!product.inStock) return
    // Size-based products must be configured on the detail page first.
    if (needsSize) {
      router.push(href)
      return
    }
    add(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.image,
        maxQuantity: product.quantity,
      },
      1,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const addLabel = needsSize ? dict.product.chooseSize : dict.product.addToCart
  const canBuy = product.inStock

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]">
      <div className="relative">
        <Link
          href={href}
          className="relative block aspect-square overflow-hidden bg-muted/70"
        >
          {primary ? (
            <>
              <Image
                src={primary || '/placeholder.svg'}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                quality={90}
                className={cn(
                  'object-cover transition-all duration-500 ease-out group-hover:scale-[1.04]',
                  hoverImage && 'group-hover:opacity-0',
                )}
              />
              {hoverImage && (
                <Image
                  src={hoverImage}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  quality={80}
                  className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
              {dict.product.noPhoto}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </Link>

        <div className="absolute left-2.5 top-2.5 z-10 flex max-w-[70%] flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold leading-5 text-destructive-foreground shadow-sm">
              −{discount}%
            </span>
          )}
          {product.isPopular && product.inStock && !product.isPreorder && !product.isComingSoon && (
            <span className="rounded-full bg-foreground/90 px-2 py-0.5 text-[11px] font-medium leading-5 text-background shadow-sm">
              {dict.product.popularBadge}
            </span>
          )}
          {product.isPreorder ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium leading-5 text-primary-foreground shadow-sm">
              {dict.product.preorder}
            </span>
          ) : product.isComingSoon ? (
            <span className="rounded-full bg-warning px-2 py-0.5 text-[11px] font-medium leading-5 text-background shadow-sm">
              {dict.product.comingSoon}
            </span>
          ) : (
            !product.inStock && (
              <span className="rounded-full bg-secondary/95 px-2 py-0.5 text-[11px] font-medium leading-5 text-secondary-foreground shadow-sm">
                {dict.product.outOfStock}
              </span>
            )
          )}
        </div>

        <FavoriteButton
          productId={product.id}
          className="absolute right-2.5 top-2.5 z-10 size-8 opacity-90 shadow-sm backdrop-blur-md transition-opacity group-hover:opacity-100 sm:size-9"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div className="relative min-h-[2.5rem]">
          <Link
            ref={nameRef}
            href={href}
            className="peer line-clamp-2 text-[13px] font-medium leading-snug tracking-tight text-foreground transition-colors hover:text-primary sm:text-sm"
          >
            {product.name}
          </Link>
          {truncated && (
            <Link
              href={href}
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none invisible absolute -inset-x-2 bottom-[-0.25rem] z-20 rounded-lg border border-border bg-card p-2 text-sm font-medium leading-snug text-foreground opacity-0 shadow-lg transition-opacity duration-150 hover:pointer-events-auto hover:visible hover:opacity-100 hover:text-primary peer-hover:pointer-events-auto peer-hover:visible peer-hover:opacity-100"
            >
              {product.name}
            </Link>
          )}
        </div>

        {product.purchasedCount > 0 ? (
          <span className="text-[11px] text-muted-foreground sm:text-xs">
            {fillTemplate(
              pluralize(
                product.purchasedCount,
                dict.product.purchasedOne,
                dict.product.purchasedFew,
                dict.product.purchasedMany,
              ),
              { count: product.purchasedCount },
            )}
          </span>
        ) : (
          <span className="h-[1.125rem]" aria-hidden />
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0">
            {product.oldPrice && product.oldPrice > product.price ? (
              <span className="block text-[11px] text-muted-foreground line-through sm:text-xs">
                {formatPrice(product.oldPrice, product.currency)}
              </span>
            ) : (
              <span className="block h-[1.125rem]" aria-hidden />
            )}
            <span className="block truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {formatPrice(product.price, product.currency)}
            </span>
          </div>
          <Button
            size="icon"
            onClick={handleAdd}
            disabled={!canBuy}
            aria-label={addLabel}
            className={cn(
              'size-9 shrink-0 rounded-full shadow-sm transition-transform sm:size-10',
              canBuy && 'hover:scale-105',
              added && 'bg-success text-primary-foreground hover:bg-success',
            )}
          >
            {added ? (
              <Check className="size-4 sm:size-5" />
            ) : needsSize ? (
              <Ruler className="size-4 sm:size-5" />
            ) : (
              <ShoppingCart className="size-4 sm:size-5" />
            )}
          </Button>
        </div>
      </div>
    </article>
  )
}
