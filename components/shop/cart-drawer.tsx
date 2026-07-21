'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type ReactNode } from 'react'
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'

export function CartDrawer({ children }: { children: ReactNode }) {
  const { items, total, count, setQuantity, remove, drawerOpen, setDrawerOpen } = useCart()
  const { dict, locale } = useI18n()
  const lp = (p: string) => localizedPath(p, locale)
  const t = dict.cart
  const tp = dict.product

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {t.title} {count > 0 && `(${count})`}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <ShoppingBag className="size-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t.empty}</p>
            <Button asChild variant="outline" onClick={() => setDrawerOpen(false)}>
              <Link href={lp('/catalog')}>{t.goToCatalog}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="-mx-6 flex-1 space-y-4 overflow-y-auto px-6">
              {items.map((item) => (
                <div key={item.key} className="flex gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.image ? (
                      <Image src={item.image || '/placeholder.svg'} alt={item.name} fill sizes="64px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <Link
                      href={lp(`/product/${item.id}`)}
                      onClick={() => setDrawerOpen(false)}
                      className="line-clamp-2 text-sm font-medium hover:text-primary"
                    >
                      {item.name}
                    </Link>
                    {item.variantLabel ? (
                      <span className="text-xs text-muted-foreground">{item.variantLabel}</span>
                    ) : null}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          onClick={() => setQuantity(item.key, item.quantity - 1)}
                          aria-label={tp.decrease}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          onClick={() => setQuantity(item.key, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                          aria-label={tp.increase}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={() => remove(item.key)}
                    aria-label={t.remove}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <SheetFooter className="flex-col gap-3 sm:flex-col">
              <div className="flex items-center justify-between text-base">
                <span className="text-muted-foreground">{t.total}:</span>
                <span className="text-xl font-bold">{formatPrice(total)}</span>
              </div>
              <Button asChild size="lg" className="w-full" onClick={() => setDrawerOpen(false)}>
                <Link href={lp('/checkout')}>{t.checkout}</Link>
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setDrawerOpen(false)}>
                {t.continueShopping}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
