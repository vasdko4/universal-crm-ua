'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoadingImage } from '@/components/shop/loading-image'
import { isProxiedMedia } from '@/lib/shop/own-image-url'
import { cn } from '@/lib/utils'

type Props = {
  /** The purchase panel element: the bar shows once it has scrolled fully
   *  out of view, and hides again while any of it is visible. */
  targetRef: { current: HTMLElement | null }
  name: string
  image: string | null
  price: string
  oldPrice: string | null
  buyLabel: string
  canBuy: boolean
  onBuy: () => void
}

/**
 * Desktop-only sticky buy bar (hidden lg:flex). It sits directly under the
 * sticky site header (top 155px — measured header height: 43px utility bar +
 * 69px main row + 43px nav row, verified live on powerfox.shop) and slides in once the purchase panel has
 * scrolled out of view. Deliberately NOT rendered on mobile: the pinned
 * duplicate used to float over the bottom navigation and cover content.
 */
export function ProductStickyBuyBar({
  targetRef,
  name,
  image,
  price,
  oldPrice,
  buyLabel,
  canBuy,
  onBuy,
}: Props) {
  const [pastPanel, setPastPanel] = useState(false)

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setPastPanel(!entry.isIntersecting), {
      threshold: 0,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [targetRef])

  return (
    <div
      aria-hidden={!pastPanel}
      className={cn(
        'fixed inset-x-0 top-[155px] z-30 hidden border-b border-border bg-card/95 backdrop-blur transition-all duration-300 lg:flex lg:justify-center',
        pastPanel ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0',
      )}
    >
      <div className="flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 lg:px-8">
        {image ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40">
            <LoadingImage
              src={image}
              alt=""
              fill
              sizes="56px"
              quality={75}
              unoptimized={isProxiedMedia(image)}
              showSpinner={false}
              className="object-cover"
            />
          </span>
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl font-bold text-primary">
            {name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          {oldPrice && <span className="text-sm text-muted-foreground line-through">{oldPrice}</span>}
          <span className="text-lg font-extrabold text-foreground">{price}</span>
        </span>
        <Button onClick={onBuy} disabled={!canBuy} className="h-10 shrink-0 rounded-full px-5">
          <ShoppingCart className="mr-1.5 size-4" /> {buyLabel}
        </Button>
      </div>
    </div>
  )
}
