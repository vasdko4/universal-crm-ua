'use client'

import { useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProductOption, VariantOptions } from '@/lib/db/schema'
import { ImageUploader } from '@/components/products/image-uploader'
import type { VariantInput } from '@/app/actions/products'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type Props = {
  options: ProductOption[]
  variants: VariantInput[]
  currency: string
  onChange: (options: ProductOption[], variants: VariantInput[]) => void
}

function labelFor(options: VariantOptions): string {
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' / ')
}

// Cartesian product of every axis's values -> one row per combination.
function buildCombinations(options: ProductOption[]): VariantOptions[] {
  const axes = options.filter((o) => o.name.trim() && o.values.length > 0)
  if (axes.length === 0) return []
  let combos: VariantOptions[] = [{}]
  for (const axis of axes) {
    const next: VariantOptions[] = []
    for (const combo of combos) {
      for (const value of axis.values) {
        next.push({ ...combo, [axis.name]: value })
      }
    }
    combos = next
  }
  return combos
}

function sameOptions(a: VariantOptions, b: VariantOptions): boolean {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  return ak.every((k) => a[k] === b[k])
}

export function ProductVariantsEditor({ options, variants, currency, onChange }: Props) {
  const { dict } = useAdminI18n()
  const t = dict.productVariants
  const [newOptionName, setNewOptionName] = useState('')
  const [newOptionType, setNewOptionType] = useState<'text' | 'color'>('text')

  function updateOptions(next: ProductOption[]) {
    onChange(next, variants)
  }

  function addOption() {
    const name = newOptionName.trim()
    if (!name || options.some((o) => o.name.toLowerCase() === name.toLowerCase())) return
    updateOptions([...options, { name, type: newOptionType, values: [], swatches: {} }])
    setNewOptionName('')
    setNewOptionType('text')
  }

  function removeOption(idx: number) {
    updateOptions(options.filter((_, i) => i !== idx))
  }

  function setOptionValues(idx: number, raw: string) {
    const values = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    const next = options.map((o, i) => (i === idx ? { ...o, values } : o))
    updateOptions(next)
  }

  function setSwatch(idx: number, value: string, hex: string) {
    const next = options.map((o, i) =>
      i === idx ? { ...o, swatches: { ...(o.swatches ?? {}), [value]: hex } } : o,
    )
    updateOptions(next)
  }

  // Regenerate the matrix, preserving values already entered for existing combos.
  function generateMatrix() {
    const combos = buildCombinations(options)
    const next: VariantInput[] = combos.map((combo) => {
      const existing = variants.find((v) => sameOptions(v.options, combo))
      return (
        existing ?? {
          options: combo,
          sku: '',
          price: '',
          oldPrice: '',
          quantity: 0,
          image: '',
        }
      )
    })
    onChange(options, next)
  }

  function updateVariant(idx: number, patch: Partial<VariantInput>) {
    onChange(
      options,
      variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)),
    )
  }

  const hasAxes = options.some((o) => o.name.trim() && o.values.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.axesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t.axesHint}</p>

          {options.map((opt, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {opt.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {opt.type === 'color' ? t.typeColor : t.typeText}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  aria-label={`${t.removeAxisAria} ${opt.name}`}
                  onClick={() => removeOption(i)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`opt-values-${i}`}>{t.valuesLabel}</Label>
                <Input
                  id={`opt-values-${i}`}
                  value={opt.values.join(', ')}
                  onChange={(e) => setOptionValues(i, e.target.value)}
                  placeholder={opt.type === 'color' ? t.colorPlaceholder : t.textPlaceholder}
                />
              </div>
              {opt.type === 'color' && opt.values.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {opt.values.map((value) => (
                    <div key={value} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={opt.swatches?.[value] ?? '#cccccc'}
                        onChange={(e) => setSwatch(i, value, e.target.value)}
                        className="size-8 cursor-pointer rounded border border-border bg-transparent"
                        aria-label={`${t.colorForAria} ${value}`}
                      />
                      <span className="text-xs text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-opt-name">{t.newAxisLabel}</Label>
              <Input
                id="new-opt-name"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                placeholder={t.newAxisPlaceholder}
                className="w-40"
              />
            </div>
            <Select value={newOptionType} onValueChange={(v) => setNewOptionType(v as 'text' | 'color')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">{t.selectText}</SelectItem>
                <SelectItem value="color">{t.selectColor}</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={addOption}>
              <Plus className="size-4" />
              {t.addAxis}
            </Button>
          </div>

          {hasAxes && (
            <Button type="button" variant="secondary" className="w-fit" onClick={generateMatrix}>
              <RefreshCw className="size-4" />
              {t.generateMatrix}
            </Button>
          )}
        </CardContent>
      </Card>

      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.combinationsTitle} ({variants.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {variants.map((v, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 md:grid-cols-[1.3fr_repeat(4,1fr)] md:items-end"
              >
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{t.combinationLabel}</Label>
                  <span className="text-sm font-medium">{labelFor(v.options)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`v-price-${i}`} className="text-xs">
                    {t.priceLabel} ({currency})
                  </Label>
                  <Input
                    id={`v-price-${i}`}
                    inputMode="decimal"
                    value={v.price}
                    onChange={(e) => updateVariant(i, { price: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`v-old-${i}`} className="text-xs">
                    {t.oldPriceLabel}
                  </Label>
                  <Input
                    id={`v-old-${i}`}
                    inputMode="decimal"
                    value={v.oldPrice ?? ''}
                    onChange={(e) => updateVariant(i, { oldPrice: e.target.value })}
                    placeholder="—"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`v-qty-${i}`} className="text-xs">
                    {t.quantityLabel}
                  </Label>
                  <Input
                    id={`v-qty-${i}`}
                    inputMode="numeric"
                    value={String(v.quantity)}
                    onChange={(e) =>
                      updateVariant(i, { quantity: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`v-sku-${i}`} className="text-xs">
                    {t.skuLabel}
                  </Label>
                  <Input
                    id={`v-sku-${i}`}
                    value={v.sku ?? ''}
                    onChange={(e) => updateVariant(i, { sku: e.target.value })}
                    placeholder="—"
                  />
                </div>
                <div className="flex flex-col gap-1 md:col-span-5">
                  <Label className="text-xs">{t.variantImageLabel}</Label>
                  <ImageUploader
                    size="sm"
                    value={v.image ?? null}
                    onChange={(url) => updateVariant(i, { image: url ?? '' })}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
