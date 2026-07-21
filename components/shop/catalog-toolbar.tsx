'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { SlidersHorizontal, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'

export function CatalogToolbar({ total }: { total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { dict } = useI18n()

  const SORT_OPTIONS = [
    { value: 'popular', label: dict.catalog.sortPopular },
    { value: 'new', label: dict.catalog.sortNew },
    { value: 'price_asc', label: dict.catalog.sortPriceAsc },
    { value: 'price_desc', label: dict.catalog.sortPriceDesc },
  ]

  const sort = params.get('sort') ?? 'popular'
  const inStock = params.get('inStock') === '1'
  const discount = params.get('discount') === '1'
  const minPrice = params.get('minPrice') ?? ''
  const maxPrice = params.get('maxPrice') ?? ''

  // Draft price values live locally until the user applies them, so typing
  // doesn't trigger a navigation on every keystroke.
  const [draftMin, setDraftMin] = useState(minPrice)
  const [draftMax, setDraftMax] = useState(maxPrice)
  const [priceOpen, setPriceOpen] = useState(false)

  function navigate(next: URLSearchParams) {
    next.delete('page')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value == null || value === '') next.delete(key)
    else next.set(key, value)
    navigate(next)
  }

  function applyPrice() {
    const next = new URLSearchParams(params.toString())
    const min = draftMin.trim()
    const max = draftMax.trim()
    if (min && Number(min) >= 0) next.set('minPrice', min)
    else next.delete('minPrice')
    if (max && Number(max) >= 0) next.set('maxPrice', max)
    else next.delete('maxPrice')
    setPriceOpen(false)
    navigate(next)
  }

  function resetAll() {
    const next = new URLSearchParams(params.toString())
    for (const k of ['inStock', 'discount', 'minPrice', 'maxPrice', 'sort']) next.delete(k)
    setDraftMin('')
    setDraftMax('')
    navigate(next)
  }

  const priceActive = Boolean(minPrice || maxPrice)
  const activeCount = [inStock, discount, priceActive].filter(Boolean).length
  const priceLabel = priceActive
    ? minPrice && maxPrice
      ? `${minPrice} – ${maxPrice} ₴`
      : minPrice
        ? `${dict.catalog.priceFrom} ${minPrice} ₴`
        : `${dict.catalog.priceTo} ${maxPrice} ₴`
    : dict.catalog.price

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {dict.catalog.found}: <span className="font-semibold text-foreground">{total}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {/* Price range */}
          <Popover
            open={priceOpen}
            onOpenChange={(open) => {
              setPriceOpen(open)
              if (open) {
                setDraftMin(minPrice)
                setDraftMax(maxPrice)
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant={priceActive ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5"
              >
                <SlidersHorizontal className="size-3.5" />
                {priceLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  applyPrice()
                }}
              >
                <p className="text-sm font-medium text-foreground">{dict.catalog.price}, ₴</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={dict.catalog.priceFrom}
                    value={draftMin}
                    onChange={(e) => setDraftMin(e.target.value)}
                    aria-label={dict.catalog.priceFrom}
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={dict.catalog.priceTo}
                    value={draftMax}
                    onChange={(e) => setDraftMax(e.target.value)}
                    aria-label={dict.catalog.priceTo}
                  />
                </div>
                <Button type="submit" size="sm">
                  {dict.catalog.apply}
                </Button>
              </form>
            </PopoverContent>
          </Popover>

          {/* Toggles */}
          <div className="flex items-center gap-2">
            <Switch
              id="in-stock"
              checked={inStock}
              onCheckedChange={(v) => update('inStock', v ? '1' : null)}
            />
            <Label htmlFor="in-stock" className="text-sm">
              {dict.catalog.inStockOnly}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="discount-only"
              checked={discount}
              onCheckedChange={(v) => update('discount', v ? '1' : null)}
            />
            <Label htmlFor="discount-only" className="text-sm">
              {dict.catalog.discountOnly}
            </Label>
          </div>

          {/* Sort */}
          <Select value={sort} onValueChange={(v) => update('sort', v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filter chips + reset */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          {priceActive && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {priceLabel}
              <button
                type="button"
                aria-label={`${dict.catalog.resetFilters}: ${dict.catalog.price}`}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={() => {
                  const next = new URLSearchParams(params.toString())
                  next.delete('minPrice')
                  next.delete('maxPrice')
                  setDraftMin('')
                  setDraftMax('')
                  navigate(next)
                }}
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {inStock && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {dict.catalog.inStockOnly}
              <button
                type="button"
                aria-label={`${dict.catalog.resetFilters}: ${dict.catalog.inStockOnly}`}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={() => update('inStock', null)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {discount && (
            <Badge variant="secondary" className="gap-1 pr-1">
              {dict.catalog.discountOnly}
              <button
                type="button"
                aria-label={`${dict.catalog.resetFilters}: ${dict.catalog.discountOnly}`}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                onClick={() => update('discount', null)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={resetAll}
          >
            {dict.catalog.resetFilters}
          </Button>
        </div>
      )}
    </div>
  )
}
