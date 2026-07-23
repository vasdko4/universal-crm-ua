'use client'

import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { OrderReceipt, type OrderReceiptItem } from '@/components/orders/order-receipt'

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
  title = 'Чек заказа',
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
  title?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-card-foreground">
          <Receipt className="size-4" /> {title}
        </span>
        <span className="text-xs text-muted-foreground">{show ? 'Скрыть' : 'Показать'}</span>
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
          />
        </div>
      )}
    </div>
  )
}
