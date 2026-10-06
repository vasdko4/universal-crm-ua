'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Phone, User, Wallet, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import { formatPrice } from '@/lib/shop/cart-context'
import { galleryMediaPath } from '@/lib/shop/own-image-url'
import { formatUaPhoneInput, normalizeUaPhone } from '@/lib/shop/phone'
import { createOneClickGuard } from '@/lib/shop/one-click'
import { createOneClickOrder } from '@/app/actions/shop'
import { getPublicStoreSettings } from '@/app/actions/settings-store'
import { GoogleAdsPurchase } from '@/components/shop/google-ads'
import { ProductVariantSelector } from '@/components/shop/product-variant-selector'
import type { ShopProduct, ProductVariant } from '@/lib/shop/queries'
import { cn } from '@/lib/utils'

function matchVariant(variants: ProductVariant[], selected: Record<string, string>, optionCount: number) {
  if (Object.keys(selected).length < optionCount) return null
  return (
    variants.find((v) => Object.entries(selected).every(([k, val]) => v.options[k] === val)) ?? null
  )
}

function variantLabel(v: ProductVariant): string {
  return Object.entries(v.options)
    .map(([k, val]) => `${k}: ${val}`)
    .join(' / ')
}

type Gads = {
  enabled: boolean
  conversionId: string
  conversionLabel: string
  gaEnabled: boolean
  gaMeasurementId: string
  enhancedConversionsEnabled: boolean
} | null

/**
 * "Купити в 1 клік" trigger + modal. The trigger opens the modal; the modal
 * only asks for name + phone (variant selection when the product has choice
 * axes), then creates the order via createOneClickOrder and shows an in-modal
 * confirmation with the order number — never a redirect, so the shopper stays
 * on the product/listing page.
 */
export function OneClickBuyButton({
  product,
  variantId,
  className,
}: {
  product: ShopProduct
  /** Pre-selected variant (the product page passes its inline selection). */
  variantId?: number
  className?: string
}) {
  const router = useRouter()
  const { dict, locale } = useI18n()
  const [open, setOpen] = useState(false)

  if (!product.inStock) return null

  // Listing payloads may strip options/variants (toListingCard sets
  // needsSizeChoice beforehand). With no options in the payload the modal
  // cannot offer a choice — send the shopper to the product page instead,
  // exactly like the card's own "choose size" button does.
  const needsSizeChoice =
    product.needsSizeChoice ??
    (product.variantsEnabled && product.options.length > 0 && product.variants.length > 1)
  const optionsAvailable = product.options.length > 0
  const href = localizedPath(`/product/${product.slug}`, locale)

  function handleClick() {
    if (needsSizeChoice && !optionsAvailable && !variantId) {
      router.push(href)
      return
    }
    setOpen(true)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        data-testid="one-click-buy"
        aria-label={dict.oneClick.button}
        className={cn('h-9 w-full rounded-lg px-2 text-sm font-semibold', className)}
      >
        <Zap className="size-3.5" />
        <span>{dict.oneClick.button}</span>
      </Button>
      <OneClickModal open={open} onOpenChange={setOpen} product={product} initialVariantId={variantId} />
    </>
  )
}

function OneClickModal({
  open,
  onOpenChange,
  product,
  initialVariantId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ShopProduct
  initialVariantId?: number
}) {
  const { dict, locale } = useI18n()
  const t = dict.oneClick
  const hasVariants = product.variantsEnabled && product.options.length > 0 && product.variants.length > 0

  const [selected, setSelected] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ orderNumber: string; total: number } | null>(null)
  const [gads, setGads] = useState<Gads>(null)
  // Guard object lives for the modal's lifetime — double clicks can never
  // slip two submissions past the disabled button.
  const [guard] = useState(createOneClickGuard)
  // Server-side idempotency key: one UUID per modal open, so a retried
  // submit (double-tap on slow network) returns the existing order.
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null)

  // Reset the form each time the modal opens. This is the React-endorsed
  // "adjust state during render" pattern — a setState-in-effect would trip
  // the react-hooks lint rule here.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const v =
        initialVariantId != null ? product.variants.find((x) => x.id === initialVariantId) : null
      setSelected(v ? { ...v.options } : {})
      setFieldError(null)
      setSubmitting(false)
      setSuccess(null)
      guard.reset()
      setIdempotencyKey(crypto.randomUUID())
    }
  }

  const selectedVariant = useMemo(
    () => (hasVariants ? matchVariant(product.variants, selected, product.options.length) : null),
    [hasVariants, product.variants, product.options.length, selected],
  )

  const price = selectedVariant?.price ?? product.price
  const oldPrice = selectedVariant ? selectedVariant.oldPrice : product.oldPrice
  const thumb = galleryMediaPath(selectedVariant?.image ?? product.image)

  // Google Ads purchase conversion: fired on the in-modal confirmation with
  // the same sessionStorage dedup (per order number) the order-confirmation
  // page uses, so a refresh never double-counts the purchase.
  useEffect(() => {
    if (!success) return
    let cancelled = false
    getPublicStoreSettings()
      .then((s) => {
        if (cancelled) return
        setGads(s.googleAds ?? null)
      })
      .catch(() => {
        /* analytics is best-effort — the order itself already succeeded */
      })
    return () => {
      cancelled = true
    }
  }, [success])

  async function handleSubmit() {
    setFieldError(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFieldError(t.invalidName)
      return
    }
    const normalizedPhone = normalizeUaPhone(phone)
    if (!normalizedPhone) {
      setFieldError(t.invalidPhone)
      return
    }
    if (hasVariants && !selectedVariant) {
      setFieldError(dict.product.selectVariant)
      return
    }
    // Idempotency: reject a repeat click while the first request is in flight.
    if (!guard.start()) return
    setSubmitting(true)
    try {
      const res = await createOneClickOrder({
        productId: product.id,
        variantId: selectedVariant?.id,
        name: trimmedName,
        phone: normalizedPhone,
        idempotencyKey: idempotencyKey ?? undefined,
      })
      if (!res.success) {
        guard.reset()
        setSubmitting(false)
        setFieldError(res.error)
        return
      }
      setSubmitting(false)
      setSuccess({ orderNumber: res.orderNumber, total: res.total })
    } catch {
      guard.reset()
      setSubmitting(false)
      setFieldError(dict.product.error)
    }
  }

  function handleClose(next: boolean) {
    if (submitting) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Zap className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-base leading-tight">{t.title}</DialogTitle>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center px-5 py-6 text-center">
            {gads && ((gads.enabled && gads.conversionId && gads.conversionLabel) || (gads.gaEnabled && gads.gaMeasurementId)) ? (
              <GoogleAdsPurchase
                conversionId={gads.enabled ? gads.conversionId : undefined}
                conversionLabel={gads.enabled ? gads.conversionLabel : undefined}
                gaId={gads.gaEnabled ? gads.gaMeasurementId : undefined}
                orderNumber={success.orderNumber}
                value={success.total}
                currency="UAH"
                items={[
                  {
                    id: product.id,
                    name: product.name,
                    price,
                    quantity: 1,
                    sku: selectedVariant?.sku ?? product.sku,
                  },
                ]}
                enhancedConversions={gads.enhancedConversionsEnabled ?? false}
                customerEmail={null}
                customerPhone={normalizeUaPhone(phone)}
              />
            ) : null}
            <div className="flex size-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="size-8 text-success" />
            </div>
            <h3 className="mt-3 text-lg font-semibold text-foreground">{t.successTitle}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.successOrderNumber}{' '}
              <span className="font-bold text-foreground">№{success.orderNumber}</span>
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t.successHint}</p>
            <Button type="button" className="mt-5 h-11 w-full text-base" onClick={() => onOpenChange(false)}>
              {t.close}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              {thumb ? (
                <Image
                  src={thumb}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="size-16 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {product.name}
                </p>
                {selectedVariant ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {variantLabel(selectedVariant)}
                  </p>
                ) : null}
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-base font-bold text-foreground">
                    {formatPrice(price, product.currency, locale)}
                  </span>
                  {oldPrice && oldPrice > price ? (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(oldPrice, product.currency, locale)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {hasVariants && !initialVariantId ? (
              <ProductVariantSelector
                options={product.options}
                variants={product.variants}
                selected={selected}
                onSelect={(opt, val) => setSelected((prev) => ({ ...prev, [opt]: val }))}
              />
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="one-click-name">{t.nameLabel}</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="one-click-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  autoComplete="name"
                  maxLength={120}
                  className="h-11 pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="one-click-phone">{t.phoneLabel}</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="one-click-phone"
                  value={phone}
                  onChange={(e) => setPhone(formatUaPhoneInput(e.target.value))}
                  placeholder={t.phonePlaceholder}
                  autoComplete="tel"
                  inputMode="tel"
                  className="h-11 pl-9"
                />
              </div>
            </div>

            {fieldError ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {fieldError}
              </p>
            ) : null}

            <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 px-3 py-2.5">
              <Wallet className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">{t.paymentNote}</p>
            </div>

            <Button
              type="button"
              className="h-12 w-full text-base font-semibold"
              size="lg"
              disabled={submitting}
              onClick={handleSubmit}
              data-testid="one-click-submit"
            >
              <Phone className="mr-1 size-5" />
              {submitting ? t.submitting : t.submit}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
