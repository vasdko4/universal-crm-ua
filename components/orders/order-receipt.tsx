'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/shop/format'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'

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
  locale,
  dict,
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
  dict: Dictionary['receipt']
}) {
  const date = createdAt ? new Date(createdAt) : null
  const dateLocale = locale === 'ru' ? 'ru-RU' : 'uk-UA'

  return (
    <div className="flex flex-col gap-3">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #order-receipt-print, #order-receipt-print * { visibility: visible; }
          #order-receipt-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
        }
      `}</style>

      <div
        id="order-receipt-print"
        className="mx-auto w-full max-w-sm rounded-sm border border-neutral-200 bg-white p-5 font-mono text-[13px] leading-snug text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-8px_rgba(0,0,0,0.15)] print:border-0 print:shadow-none"
      >
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-wide">{storeName}</p>
          <div className="my-2 border-t border-dashed border-neutral-400" />
          <p>{dict.checkNumber}{orderNumber}</p>
          {date && <p>{date.toLocaleString(dateLocale)}</p>}
        </div>

        <div className="my-3 border-t border-dashed border-neutral-400" />

        <div className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <div className="flex justify-between gap-2">
                <span>
                  {it.name}
                  {it.variantLabel ? ` (${it.variantLabel})` : ''}
                </span>
              </div>
              {it.sku && <p className="text-[11px] text-neutral-500">SKU {it.sku}</p>}
              <div className="flex justify-between text-neutral-600">
                <span>
                  {it.quantity} × {formatPrice(it.price, currency)}
                </span>
                <span>{formatPrice(it.total, currency)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="my-3 border-t border-dashed border-neutral-400" />

        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <span>{dict.goods}</span>
            <span>{formatPrice(itemsTotal, currency)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between">
              <span>{dict.discount}</span>
              <span>−{formatPrice(discountTotal, currency)}</span>
            </div>
          )}
          {deliveryCost > 0 && (
            <div className="flex justify-between">
              <span>{dict.delivery}</span>
              <span>{formatPrice(deliveryCost, currency)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-dashed border-neutral-400 pt-1 text-sm font-bold">
            <span>{dict.total.toUpperCase()}</span>
            <span>{formatPrice(total, currency)}</span>
          </div>
        </div>

        <div className="my-3 border-t border-dashed border-neutral-400" />

        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline
              data: URL, Next/Image's optimizer can't handle it and it isn't needed for a tiny 240px QR. */}
          <img src={qrDataUrl} alt="QR" className="size-28" />
          <p className="text-center text-[10px] uppercase tracking-wide text-neutral-500">
            {isFiscal ? dict.fiscalLabel : dict.nonFiscalLabel}
          </p>
          <p className="text-center text-xs font-semibold">{dict.thankYou}</p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mx-auto gap-2 print:hidden"
        onClick={() => window.print()}
      >
        <Printer className="size-4" /> {dict.print}
      </Button>
    </div>
  )
}
