'use client'

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { OrderReceipt, type OrderReceiptItem } from '@/components/orders/order-receipt'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'

export function OrderReceiptSection({
  storeName,
  orderNumber,
  createdAt,
  items,
  itemsTotal,
  discountTotal,
  deliveryCost,
  total,
  currency,
  isFiscal,
  qrDataUrl,
  locale,
  title,
}: {
  storeName: string
  orderNumber: string
  createdAt: string | Date | null
  items: OrderReceiptItem[]
  itemsTotal: number
  discountTotal: number
  deliveryCost: number
  total: number
  currency: string
  isFiscal: boolean
  qrDataUrl: string
  locale: Locale
  title?: string
}) {
  const [show, setShow] = useState(false)
  // The receipt always uses the shop-facing dictionary (not the separate
  // admin one) so the printed document reads the same regardless of which
  // panel (customer account vs admin) opened it.
  const dict = getDictionary(locale).receipt
  const sectionTitle = title ?? dict.sectionTitle

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-card-foreground">
          <Receipt className="size-4" /> {sectionTitle}
        </span>
        <span className="text-xs text-muted-foreground">{show ? dict.hide : dict.show}</span>
      </button>
      {show && (
        <div className="mt-4">
          <OrderReceipt
            storeName={storeName}
            orderNumber={orderNumber}
            createdAt={createdAt}
            items={items}
            itemsTotal={itemsTotal}
            discountTotal={discountTotal}
            deliveryCost={deliveryCost}
            total={total}
            currency={currency}
            isFiscal={isFiscal}
            qrDataUrl={qrDataUrl}
            locale={locale}
            dict={dict}
          />
        </div>
      )}
    </div>
  )
}
