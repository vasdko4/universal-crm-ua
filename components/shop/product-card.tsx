'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import type { ShopProduct } from '@/lib/shop/queries'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import { fillTemplate } from '@/lib/i18n/dictionaries'
import { pluralize } from '@/lib/i18n/plural'
import { FavoriteButton } from '@/components/shop/favorite-button'
import { cn } from '@/lib/utils'

const IMAGE_SIZES = '(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw'

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
    toast.success(dict.product.addedToCart, { description: product.name })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const addLabel = needsSize
    ? dict.product.chooseSize
    : added
      ? dict.product.addedToCartVariant
      : dict.product.buy
  const canBuy = product.inStock

  return (
    <article className="group relative flex h-full flex-col overflow-visible rounded-lg border border-border/70 bg-card transition-shadow hover:shadow-md">
      <div className="relative overflow-hidden rounded-t-lg">
        <Link href={href} className="relative block aspect-square overflow-hidden bg-muted/60">
          {primary ? (
            <>
              <Image
                src={primary || '/placeholder.svg'}
                alt={product.name}
                fill
                sizes={IMAGE_SIZES}
                quality={85}
                className={cn(
                  'object-cover transition-opacity duration-300',
                  hoverImage && 'group-hover:opacity-0',
                )}
              />
              {hoverImage && (
                <Image
                  src={hoverImage}
                  alt=""
                  fill
                  sizes={IMAGE_SIZES}
                  quality={75}
                  className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
              {dict.product.noPhoto}
            </div>
          )}
        </Link>

        <div className="absolute left-1.5 top-1.5 z-10 flex max-w-[72%] flex-col items-start gap-1">
          {discount > 0 && (
            <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-destructive-foreground">
              −{discount}%
            </span>
          )}
          {product.isPopular && product.inStock && !product.isPreorder && !product.isComingSoon && (
            <span className="rounded bg-foreground/90 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-background">
              {dict.product.popularBadge}
            </span>
          )}
          {product.isPreorder ? (
            <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-4 text-primary-foreground">
              {dict.product.preorder}
            </span>
          ) : product.isComingSoon ? (
            <span className="rounded bg-warning px-1.5 py-0.5 text-[10px] font-medium leading-4 text-background">
              {dict.product.comingSoon}
            </span>
          ) : (
            !product.inStock && (
              <span className="rounded bg-secondary/95 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-secondary-foreground">
                {dict.product.outOfStock}
              </span>
            )
          )}
        </div>

        <FavoriteButton
          productId={product.id}
          className="absolute right-1.5 top-1.5 z-10 size-7 border-0 bg-white text-neutral-500 shadow-md hover:bg-white hover:text-destructive sm:right-2 sm:top-2 sm:size-8"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
        <div className="relative min-h-[2.25rem]">
          <Link
            ref={nameRef}
            href={href}
            className="peer line-clamp-2 text-[12px] font-normal leading-snug text-foreground hover:text-primary sm:text-[13px]"
          >
            {product.name}
          </Link>
          {truncated && (
            <Link
              href={href}
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none invisible absolute -inset-x-1 bottom-[-0.2rem] z-20 rounded-md border border-border bg-card p-1.5 text-[12px] font-normal leading-snug text-foreground opacity-0 shadow-md transition-opacity duration-150 hover:pointer-events-auto hover:visible hover:opacity-100 hover:text-primary peer-hover:pointer-events-auto peer-hover:visible peer-hover:opacity-100"
            >
              {product.name}
            </Link>
          )}
        </div>

        {product.purchasedCount > 0 ? (
          <span className="text-[10px] text-muted-foreground sm:text-[11px]">
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
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-1.5 pt-1">
          <div className="min-w-0">
            {product.oldPrice && product.oldPrice > product.price ? (
              <span className="block truncate text-[10px] leading-none text-muted-foreground line-through sm:text-[11px]">
                {formatPrice(product.oldPrice, product.currency)}
              </span>
            ) : null}
            <span className="block truncate text-sm font-bold leading-tight tracking-tight text-foreground sm:text-[15px]">
              {formatPrice(product.price, product.currency)}
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!canBuy}
            aria-label={addLabel}
            data-testid={needsSize ? 'choose-size' : 'add-to-cart'}
            className={cn(
              'h-7 shrink-0 rounded-md px-2.5 text-[11px] font-semibold sm:h-8 sm:px-3 sm:text-[12px]',
              added && 'bg-success text-primary-foreground hover:bg-success',
            )}
          >
            {added && !needsSize ? (
              <>
                <Check className="size-3.5" />
                {addLabel}
              </>
            ) : (
              addLabel
            )}
          </Button>
        </div>
      </div>
    </article>
  )
}
