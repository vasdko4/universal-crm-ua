'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Plus } from 'lucide-react'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import type { ShopProduct } from '@/lib/shop/queries'

/** Pure helper — total price of the selected bundle items. */
export function calcBundleTotal(items: { price: number }[]): number {
  return items.reduce((sum, i) => sum + i.price, 0)
}

type Props = {
  main: ShopProduct
  items: ShopProduct[]
}

/**
 * "Frequently bought together" bundle builder (Amazon-style): the current
 * product plus real co-purchase add-ons, each toggleable. One button adds
 * everything selected to the cart and shows the live combined price.
 */
export function FrequentlyBoughtTogether({ main, items }: Props) {
  const { add } = useCart()
  const { dict, locale } = useI18n()
  const t = dict.product
  // Add-ons that require a size/variant choice can't be 1-click added to the
  // cart — same rule as ProductCard (which redirects to the product page
  // instead). Exclude them from the bundle rather than adding a wrong variant.
  const addable = useMemo(
    () =>
      items.filter(
        (p) =>
          !(
            p.needsSizeChoice ??
            (p.variantsEnabled && p.options.some((o) => o.values.length > 1) && p.variants.length > 1)
          ),
      ),
    [items],
  )
  // Main product is always in the bundle; add-ons start checked.
  const [selected, setSelected] = useState<number[]>(() => addable.map((p) => p.id))

  const bundle = useMemo(
    () => [main, ...addable.filter((p) => selected.includes(p.id))],
    [main, addable, selected],
  )
  const total = useMemo(() => calcBundleTotal(bundle), [bundle])

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const handleAddAll = () => {
    for (const p of bundle) {
      if (!p.inStock) continue
      add(
        {
          id: p.id,
          slug: p.slug,
          name: p.name,
          price: p.price,
          image: p.image,
          maxQuantity: p.quantity,
        },
        1,
      )
    }
  }

  const thumbs = [main, ...addable]

  // Nothing to bundle — the section stays hidden, same as before.
  if (addable.length === 0) return null

  return (
    <section className="mt-8 lg:mt-14" aria-label={t.frequentlyBoughtTogether}>
      <h2 className="mb-3 text-lg font-bold tracking-tight text-foreground lg:mb-5 lg:text-2xl">
        {t.frequentlyBoughtTogether}
      </h2>
      <div className="rounded-2xl border border-border bg-card p-4 lg:p-6">
        {/* Thumbnails strip: main + add-ons with toggle checkboxes */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {thumbs.map((p, i) => {
            const isMain = i === 0
            const checked = isMain || selected.includes(p.id)
            return (
              <div key={p.id} className="flex items-center gap-2 lg:gap-3">
                {i > 0 && <Plus className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
                <button
                  type="button"
                  disabled={isMain}
                  onClick={() => toggle(p.id)}
                  aria-pressed={checked}
                  aria-label={p.name}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-muted transition lg:h-24 lg:w-24 ${
                    checked ? 'border-primary' : 'border-border opacity-60'
                  } ${isMain ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {p.image ? (
                    <Image src={p.image} alt={p.name} fill sizes="96px" className="object-contain p-1" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-xs text-muted-foreground">—</span>
                  )}
                  {!isMain && (
                    <span
                      className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border ${
                        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground bg-background'
                      }`}
                    >
                      {checked && <Check className="h-3.5 w-3.5" aria-hidden />}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        {/* Selectable list with prices */}
        <ul className="mt-4 space-y-2">
          <li className="flex items-center gap-3 text-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="font-medium text-muted-foreground">{t.thisItem}:</span>
            <span className="min-w-0 flex-1 truncate font-medium">{main.name}</span>
            <span className="font-semibold">{formatPrice(main.price, main.currency, locale)}</span>
          </li>
          {addable.map((p) => {
            const checked = selected.includes(p.id)
            const href = localizedPath(`/product/${p.slug}`, locale)
            return (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  <Link href={href} className="min-w-0 flex-1 truncate hover:underline">
                    {p.name}
                  </Link>
                  <span className={`font-semibold ${checked ? '' : 'text-muted-foreground line-through'}`}>
                    {formatPrice(p.price, p.currency, locale)}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        {/* Total + add-all */}
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {t.frequentlyBoughtTogether}:{' '}
            <span className="text-base font-bold text-foreground">
              {formatPrice(total, main.currency, locale)}
            </span>{' '}
            <span className="text-xs">({bundle.length})</span>
          </div>
          <button
            type="button"
            onClick={handleAddAll}
            disabled={bundle.length === 0}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {t.addSelectedToCart} ({bundle.length})
          </button>
        </div>
      </div>
    </section>
  )
}
