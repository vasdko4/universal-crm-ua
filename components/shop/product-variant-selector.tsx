'use client'

import { cn } from '@/lib/utils'
import type { ProductOption, ProductVariant } from '@/lib/shop/queries'

type Props = {
  options: ProductOption[]
  variants: ProductVariant[]
  selected: Record<string, string>
  onSelect: (optionName: string, value: string) => void
}

// Returns true if choosing `value` for `optionName` can still lead to at least
// one in-stock variant, given the other currently selected axes.
function valueHasStock(
  optionName: string,
  value: string,
  options: ProductOption[],
  variants: ProductVariant[],
  selected: Record<string, string>,
): boolean {
  return variants.some((v) => {
    if (!v.inStock) return false
    if (v.options[optionName] !== value) return false
    // Respect other selected axes (but not the one we're testing).
    return options.every((o) => {
      if (o.name === optionName) return true
      const sel = selected[o.name]
      if (!sel) return true
      return v.options[o.name] === sel
    })
  })
}

export function ProductVariantSelector({ options, variants, selected, onSelect }: Props) {
  if (options.length === 0) return null

  return (
    <div className="space-y-4">
      {options.map((opt) => {
        const isColor = opt.type === 'color'
        return (
          <div key={opt.name} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{opt.name}</span>
              {selected[opt.name] ? (
                <span className="text-sm text-muted-foreground">{selected[opt.name]}</span>
              ) : (
                <span className="text-xs text-destructive">Выберите: {opt.name.toLowerCase()}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {opt.values.map((val) => {
                const active = selected[opt.name] === val
                const available = valueHasStock(opt.name, val, options, variants, selected)
                if (isColor) {
                  const hex = opt.swatches?.[val] ?? '#d4d4d4'
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onSelect(opt.name, val)}
                      aria-pressed={active}
                      aria-label={val}
                      title={available ? val : `${val} — нет в наличии`}
                      className={cn(
                        'relative flex size-10 items-center justify-center rounded-full border-2 transition',
                        active ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/60',
                        !available && 'opacity-40',
                      )}
                    >
                      <span
                        className="size-7 rounded-full border border-black/10"
                        style={{ backgroundColor: hex }}
                      />
                      {!available && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="h-px w-8 rotate-45 bg-destructive" />
                        </span>
                      )}
                    </button>
                  )
                }
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onSelect(opt.name, val)}
                    aria-pressed={active}
                    className={cn(
                      'flex h-10 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-foreground hover:border-primary/60',
                      !available && 'text-muted-foreground line-through opacity-50',
                    )}
                  >
                    {val}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
