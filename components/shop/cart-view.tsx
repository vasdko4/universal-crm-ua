'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'

export function CartView({ minOrder }: { minOrder?: { enabled: boolean; amount: number } } = {}) {
  const { items, setQuantity, remove, total, count } = useCart()
  const { locale } = useI18n()
  const lp = (p: string) => localizedPath(p, locale)
  const minOrderShortfall =
    minOrder?.enabled && minOrder.amount > 0 ? Math.max(0, minOrder.amount - total) : 0
  const belowMinOrder = minOrderShortfall > 0

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-20 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Ваша корзина пуста</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Добавьте товары из каталога, чтобы оформить заказ.
        </p>
        <Button asChild className="mt-6">
          <Link href={lp('/catalog')}>Перейти в каталог</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex gap-4 rounded-2xl border border-border bg-card p-3 md:p-4"
          >
            <Link
              href={lp(`/product/${item.id}`)}
              className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted md:size-24"
            >
              {item.image ? (
                <Image
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ShoppingBag className="size-6 text-muted-foreground" />
                </div>
              )}
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <Link
                href={lp(`/product/${item.id}`)}
                className="line-clamp-2 text-sm font-medium text-foreground hover:text-primary"
              >
                {item.name}
              </Link>
              {item.variantLabel ? (
                <p className="mt-1 text-xs text-muted-foreground">{item.variantLabel}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">В наличии</p>
              )}

              <div className="mt-auto flex items-center justify-between pt-2">
                <div className="flex items-center rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setQuantity(item.key, item.quantity - 1)}
                    className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Уменьшить количество"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-9 text-center text-sm font-medium text-foreground">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.key, item.quantity + 1)}
                    className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Увеличить количество"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(item.key)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Удалить товар"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Итого</h2>
          <div className="mt-4 flex justify-between text-sm text-muted-foreground">
            <span>Товары ({count})</span>
            <span className="text-foreground">{formatPrice(total)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm text-muted-foreground">
            <span>Доставка</span>
            <span>по тарифам перевозчика</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4">
            <span className="font-semibold text-foreground">К оплате</span>
            <span className="text-lg font-bold text-foreground">{formatPrice(total)}</span>
          </div>
          {belowMinOrder && (
            <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              Минимальная сумма заказа — {formatPrice(minOrder!.amount)}. Добавьте товаров ещё на{' '}
              {formatPrice(minOrderShortfall)}.
            </p>
          )}
          {belowMinOrder ? (
            <Button size="lg" className="mt-5 w-full gap-2" disabled>
              Оформить заказ
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button asChild size="lg" className="mt-5 w-full gap-2">
              <Link href={lp('/checkout')}>
                Оформить заказ
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link href={lp('/catalog')}>Продолжить покупки</Link>
          </Button>
        </div>
      </aside>
    </div>
  )
}
