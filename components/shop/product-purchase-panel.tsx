'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus, ShoppingCart, Zap, Star, Truck, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ProductGallery } from '@/components/shop/product-gallery'
import { ProductVariantSelector } from '@/components/shop/product-variant-selector'
import { FavoriteButton } from '@/components/shop/favorite-button'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import type { ShopProduct, ProductVariant } from '@/lib/shop/queries'

type Labels = {
  locale: 'uk' | 'ru'
  sku: string
  inStock: string
  outOfStock: string
  noPhoto: string
}

function variantLabel(v: ProductVariant): string {
  return Object.entries(v.options)
    .map(([k, val]) => `${k}: ${val}`)
    .join(' / ')
}

// Finds the variant matching every selected axis, if fully chosen.
function matchVariant(variants: ProductVariant[], selected: Record<string, string>, optionCount: number) {
  if (Object.keys(selected).length < optionCount) return null
  return (
    variants.find((v) => Object.entries(selected).every(([k, val]) => v.options[k] === val)) ?? null
  )
}

export function ProductPurchasePanel({
  product,
  reviewAvg,
  reviewCount,
  labels,
}: {
  product: ShopProduct
  reviewAvg: number
  reviewCount: number
  labels: Labels
}) {
  const router = useRouter()
  const { add, startBuyNow } = useCart()
  const { dict, locale: uiLocale } = useI18n()
  const tp = dict.product
  const [qty, setQty] = useState(1)
  const hasVariants = product.variantsEnabled && product.options.length > 0 && product.variants.length > 0
  const [selected, setSelected] = useState<Record<string, string>>({})

  const selectedVariant = useMemo(
    () => (hasVariants ? matchVariant(product.variants, selected, product.options.length) : null),
    [hasVariants, product.variants, product.options.length, selected],
  )

  // Effective price / stock: from the chosen variant, else the product aggregate.
  const price = selectedVariant?.price ?? product.price
  const oldPrice = selectedVariant ? selectedVariant.oldPrice : product.oldPrice
  const maxQty = selectedVariant?.quantity ?? product.quantity
  const available = hasVariants ? (selectedVariant ? selectedVariant.inStock : product.inStock) : product.inStock

  const discount = oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0

  // Displayed price follows the chosen quantity (unit price × qty), so the
  // shopper always sees the actual amount for the selection.
  const displayPrice = price * qty
  const displayOldPrice = oldPrice ? oldPrice * qty : null

  const galleryImages =
    product.images.length > 0 ? product.images : [product.image].filter((v): v is string => Boolean(v))

  function handleSelect(optionName: string, value: string) {
    setSelected((prev) => ({ ...prev, [optionName]: value }))
    setQty(1)
  }

  function ensureReady(): boolean {
    if (hasVariants && !selectedVariant) {
      toast.error(tp.selectVariant)
      return false
    }
    if (!available) {
      toast.error(tp.notAvailable)
      return false
    }
    return true
  }

  function buildItem() {
    return {
      id: product.id,
      name: product.name,
      price,
      image: selectedVariant?.image ?? product.image,
      maxQuantity: maxQty,
      variantId: selectedVariant?.id ?? null,
      variantLabel: selectedVariant ? variantLabel(selectedVariant) : null,
    }
  }

  function addToCart() {
    if (!ensureReady()) return
    add(buildItem(), qty)
    toast.success(
      selectedVariant ? `${tp.addedToCartVariant} (${variantLabel(selectedVariant)})` : tp.addedToCart,
    )
  }

  function buyNow() {
    if (!ensureReady()) return
    // Express purchase: independent of the cart, so it never merges with or
    // affects items already in the cart.
    startBuyNow(buildItem(), qty)
    router.push('/checkout?buynow=1')
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
      <ProductGallery
        images={galleryImages}
        alt={product.name}
        discount={discount}
        noPhotoLabel={labels.noPhoto}
        selectedImage={selectedVariant?.image ?? null}
      />

      <div className="space-y-5 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-6">
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
          {product.name}
        </h1>

        <div className="flex flex-wrap items-center gap-4">
          {reviewCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={
                      n <= Math.round(reviewAvg)
                        ? 'size-4 fill-warning text-warning'
                        : 'size-4 text-muted-foreground'
                    }
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {reviewAvg.toFixed(1)} ({reviewCount})
              </span>
            </div>
          )}
          {(selectedVariant?.sku ?? product.sku) && (
            <span className="text-sm text-muted-foreground">
              {labels.sku}: {selectedVariant?.sku ?? product.sku}
            </span>
          )}
          <span className={available ? 'text-sm font-medium text-success' : 'text-sm text-destructive'}>
            {available ? labels.inStock : labels.outOfStock}
          </span>
          {product.purchasedCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {uiLocale === 'ru'
                ? `Купили ${product.purchasedCount} раз`
                : `Купили ${product.purchasedCount} разів`}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-end gap-3">
            {displayOldPrice && (
              <span className="text-xl text-muted-foreground line-through">
                {formatPrice(displayOldPrice, product.currency)}
              </span>
            )}
            <span className="text-4xl font-bold text-foreground">
              {!selectedVariant && product.variants.length > 1 ? `${tp.priceFrom} ` : ''}
              {formatPrice(displayPrice, product.currency)}
            </span>
          </div>
          {qty > 1 && (
            <span className="text-sm text-muted-foreground">
              {formatPrice(price, product.currency)} × {qty} {tp.unitsShort}
            </span>
          )}
        </div>

        {hasVariants && (
          <ProductVariantSelector
            options={product.options}
            variants={product.variants}
            selected={selected}
            onSelect={handleSelect}
          />
        )}

        {available ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{tp.quantity}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={tp.decrease}>
                  <Minus className="size-4" />
                </Button>
                <span className="w-12 text-center text-lg font-medium">{qty}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQty((q) => Math.min(maxQty || 1, q + 1))}
                  disabled={qty >= (maxQty || 1)}
                  aria-label={tp.increase}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {(!hasVariants || selectedVariant) && (
                <span className="text-sm text-muted-foreground">
                  {tp.inStockCount} {maxQty} {tp.unitsShort}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-stretch gap-3">
                <Button size="lg" className="min-w-0 flex-1 rounded-full" onClick={addToCart}>
                  <ShoppingCart className="mr-1 size-5" /> {tp.addToCart}
                </Button>
                <FavoriteButton productId={product.id} size="lg" className="h-11 shrink-0" />
              </div>
              <Button size="lg" variant="secondary" className="w-full rounded-full" onClick={buyNow}>
                <Zap className="mr-1 size-5" /> {tp.buyNow}
              </Button>
            </div>
          </div>
        ) : (
          <div className={cn('rounded-xl border border-border bg-muted/50 p-4 text-center text-muted-foreground')}>
            {hasVariants && !selectedVariant ? tp.selectVariant : tp.notAvailable}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Truck className="size-5 text-primary" /> {tp.deliveryUkraine}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-5 text-primary" /> {tp.officialWarranty}
          </div>
        </div>
      </div>
    </div>
  )
}
