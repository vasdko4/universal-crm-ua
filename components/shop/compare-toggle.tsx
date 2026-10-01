'use client'

import { Scale } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCompare } from '@/lib/shop/compare-context'
import { useI18n } from '@/lib/i18n/client'
import type { ShopProduct } from '@/lib/shop/queries'
import { cn } from '@/lib/utils'

/**
 * "Порівняти" toggle. Sits next to the one-click-buy button on product cards
 * and on the product page; mirrors its outline full-width styling. When the
 * 4-item tray is full, toggling a product that isn't in it shows a toast.
 */
export function CompareToggleButton({
  product,
  className,
}: {
  product: ShopProduct
  className?: string
}) {
  const { isInCompare, toggle } = useCompare()
  const { dict } = useI18n()
  const t = dict.compare
  const inCompare = isInCompare(product.id)

  function handleClick() {
    const { added, limitReached } = toggle(product.id)
    if (limitReached) {
      toast.error(t.maxReached)
    } else if (added) {
      toast.success(t.addedToast)
    }
  }

  return (
    <Button
      type="button"
      variant={inCompare ? 'secondary' : 'outline'}
      size="sm"
      onClick={handleClick}
      data-testid="compare-toggle"
      data-in-compare={inCompare}
      aria-pressed={inCompare}
      aria-label={inCompare ? t.inCompare : t.add}
      className={cn('h-9 w-full rounded-lg px-2 text-sm font-semibold', className)}
    >
      <Scale className="size-3.5" />
      <span>{inCompare ? t.inCompare : t.add}</span>
    </Button>
  )
}
