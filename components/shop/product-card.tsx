'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Check, Ruler } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import type { ShopProduct } from '@/lib/shop/queries'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import { FavoriteButton } from '@/components/shop/favorite-button'
import { cn } from '@/lib/utils'

export function ProductCard({ product }: { product: ShopProduct }) {
  const { add } = useCart()
  const router = useRouter()
  const { dict, locale } = useI18n()
  const href = localizedPath(`/product/${product.id}`, locale)
  const [added, setAdded] = useState(false)
  const needsSize = (product.sizes?.length ?? 0) > 0

  // Show the full-name flyout on hover only when the title is actually
  // truncated by line-clamp-2.
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

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg">
      <FavoriteButton productId={product.id} className="absolute right-3 top-3 z-10" />
      <Link href={href} className="relative block aspect-square overflow-hidden bg-muted">
        {product.image ? (
          <Image
            src={product.image || "/placeholder.svg"}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">{locale === 'ru' ? 'Нет фото' : 'Немає фото'}</div>
        )}
        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground">
            -{discount}%
          </span>
        )}
        {!product.inStock && (
          <span className="absolute left-3 top-3 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
            {dict.product.outOfStock}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="relative">
          <Link
            ref={nameRef}
            href={href}
            className="peer line-clamp-2 text-sm font-medium leading-snug text-foreground hover:text-primary"
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

        {product.purchasedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {locale === 'ru'
              ? `Купили ${product.purchasedCount} раз`
              : `Купили ${product.purchasedCount} разів`}
          </span>
        )}

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex flex-col">
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.oldPrice, product.currency)}
              </span>
            )}
            <span className="text-lg font-bold text-foreground">
              {formatPrice(product.price, product.currency)}
            </span>
          </div>
          <Button
            size="icon"
            onClick={handleAdd}
            disabled={!product.inStock}
            aria-label={needsSize ? (locale === 'ru' ? 'Выбрать размер' : 'Обрати розмір') : dict.product.addToCart}
            className={cn('shrink-0 rounded-lg', added && 'bg-success hover:bg-success')}
          >
            {added ? (
              <Check className="size-5" />
            ) : needsSize ? (
              <Ruler className="size-5" />
            ) : (
              <ShoppingCart className="size-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
