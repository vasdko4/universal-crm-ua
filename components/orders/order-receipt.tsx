'use client'

import { Printer, QrCode, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/shop/format'

export type OrderReceiptItem = {
  name: string
  variantLabel: string | null
  sku: string | null
  price: number
  quantity: number
  total: number
}

export function OrderReceipt({
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
}) {
  const date = createdAt ? new Date(createdAt) : null

  return (
    <div className="flex flex-col gap-3">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #order-receipt-print, #order-receipt-print * { visibility: visible; }
          #order-receipt-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div
        id="order-receipt-print"
        className="mx-auto w-full max-w-sm rounded-xl border border-dashed border-border bg-card p-5 font-mono text-xs"
      >
        <div className="text-center">
          <p className="text-sm font-semibold">{storeName}</p>
          <p className="mt-1 text-muted-foreground">Чек №{orderNumber}</p>
          {date && <p className="text-muted-foreground">{date.toLocaleString('ru-RU')}</p>}
        </div>

        <div className="my-3 border-t border-dashed border-border" />

        <div className="flex flex-col gap-1.5">
          {items.map((it, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <div className="flex justify-between gap-2">
                <span className="truncate">
                  {it.name}
                  {it.variantLabel ? ` (${it.variantLabel})` : ''}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {it.quantity} × {formatPrice(it.price, currency)}
                </span>
                <span>{formatPrice(it.total, currency)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="my-3 border-t border-dashed border-border" />

        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span>Товары</span>
            <span>{formatPrice(itemsTotal, currency)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between">
              <span>Скидка</span>
              <span>−{formatPrice(discountTotal, currency)}</span>
            </div>
          )}
          {deliveryCost > 0 && (
            <div className="flex justify-between">
              <span>Доставка</span>
              <span>{formatPrice(deliveryCost, currency)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-dashed border-border pt-1 text-sm font-semibold">
            <span>Итого</span>
            <span>{formatPrice(total, currency)}</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-border" />

        <div className="flex flex-col items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline
              data: URL, Next/Image's optimizer can't handle it and it isn't needed for a tiny 240px QR. */}
          <img src={qrDataUrl} alt="QR" className="size-28" />
          <p className="flex items-center gap-1 text-center text-[10px] text-muted-foreground">
            {isFiscal ? (
              <>
                <ShieldCheck className="size-3" /> Фискальный чек платёжной системы
              </>
            ) : (
              <>
                <QrCode className="size-3" /> Нефискальный чек — QR ведёт на сайт магазина
              </>
            )}
          </p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mx-auto gap-2 print:hidden"
        onClick={() => window.print()}
      >
        <Printer className="size-4" /> Распечатать чек
      </Button>
    </div>
  )
}
