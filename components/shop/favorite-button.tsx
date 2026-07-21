'use client'

import { Heart } from 'lucide-react'
import { useFavorites } from '@/lib/shop/favorites-context'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

export function FavoriteButton({
  productId,
  className,
  size = 'md',
}: {
  productId: number
  className?: string
  size?: 'md' | 'lg'
}) {
  const { isFavorite, toggle } = useFavorites()
  const { dict } = useI18n()
  const active = isFavorite(productId)
  const label = active ? dict.product.removeFromFavorites : dict.product.addToFavorites

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(productId)
      }}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-destructive',
        size === 'lg' ? 'size-11' : 'size-9',
        active && 'text-destructive',
        className,
      )}
    >
      <Heart className={cn(size === 'lg' ? 'size-6' : 'size-5', active && 'fill-current')} />
    </button>
  )
}
