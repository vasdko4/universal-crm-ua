'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CreditCard, Check, Loader2, ShieldCheck, ExternalLink, RefreshCw, Clock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPrice, useCart } from '@/lib/shop/cart-context'
import { markOrderPaid, checkOrderPaymentStatus } from '@/app/actions/shop'
import { useI18n } from '@/lib/i18n/client'

export function PayForm({
  orderNumber,
  total,
  paid,
  gatewayCode = null,
  gatewayPaymentUrl = null,
  paymentStatus = null,
}: {
  orderNumber: string
  total: number
  paid: boolean
  gatewayCode?: string | null
  gatewayPaymentUrl?: string | null
  paymentStatus?: string | null
}) {
  const router = useRouter()
  const { dict } = useI18n()
  const t = dict.pay
  const { clear, clearBuyNow } = useCart()
  const [processing, setProcessing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [success, setSuccess] = useState(paid || paymentStatus === 'paid')

  // A real gateway payment (WayForPay/Monobank) has an external hosted page.
  const isRealGateway = gatewayCode === 'wayforpay' || gatewayCode === 'monobank'
  const [autoChecking, setAutoChecking] = useState(isRealGateway && !paid && paymentStatus !== 'paid')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // The cart is intentionally preserved through the whole payment step so a
  // shopper who backs out can retry. Clear it only once payment has succeeded.
  useEffect(() => {
    if (success) {
      clear()
      clearBuyNow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success])

  // Auto-poll the gateway after returning from the hosted payment page so the
  // shopper doesn't have to press "check status" manually. Poll every 5s for
  // up to 2 minutes, then fall back to the manual button.
  useEffect(() => {
    if (!isRealGateway || success) return
    let attempts = 0
    const maxAttempts = 24

    async function poll() {
      attempts += 1
      try {
        const r = await checkOrderPaymentStatus(orderNumber)
        if (r.status === 'paid') {
          if (pollRef.current) clearInterval(pollRef.current)
          setAutoChecking(false)
          setSuccess(true)
          return
        }
        if (r.status === 'failed' || r.status === 'expired' || attempts >= maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current)
          setAutoChecking(false)
        }
      } catch {
        /* transient network error — keep polling */
      }
    }

    poll()
    pollRef.current = setInterval(poll, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealGateway, success, orderNumber])

  async function handlePay() {
    setProcessing(true)
    try {
      await markOrderPaid(orderNumber)
      setSuccess(true)
    } finally {
      setProcessing(false)
    }
  }

  async function handleCheckStatus() {
    setChecking(true)
    try {
      const r = await checkOrderPaymentStatus(orderNumber)
      if (r.status === 'paid') {
        setSuccess(true)
      } else if (r.status === 'failed' || r.status === 'expired') {
        toast.error(t.statusFailed)
      } else {
        toast.info(t.statusPending)
      }
    } finally {
      setChecking(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-8" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-foreground">{t.successTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.successDesc.replace('{orderNumber}', orderNumber)}
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() => router.push(`/order/${encodeURIComponent(orderNumber)}`)}
        >
          {t.orderDetails}
        </Button>
      </div>
    )
  }

  if (isRealGateway) {
    const gatewayName = gatewayCode === 'wayforpay' ? 'WayForPay' : 'Monobank'
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {t.orderPaymentTitle.replace('{orderNumber}', orderNumber)}
            </h1>
            <p className="text-sm text-muted-foreground">{t.payVia.replace('{gateway}', gatewayName)}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">{t.toPay}</span>
          <span className="text-xl font-bold text-foreground">{formatPrice(total)}</span>
        </div>

        {autoChecking && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t.autoChecking}
          </div>
        )}

        {gatewayPaymentUrl && (
          <Button asChild size="lg" className="mt-5 w-full gap-2">
            <a href={gatewayPaymentUrl}>
              <ExternalLink className="size-4" /> {t.goToPayment}
            </a>
          </Button>
        )}

        <Button
          variant="outline"
          size="lg"
          className="mt-3 w-full gap-2"
          onClick={handleCheckStatus}
          disabled={checking}
        >
          {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t.checkStatus}
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className="mt-2 w-full gap-2 text-muted-foreground"
          onClick={() => router.push('/checkout')}
        >
          <ArrowLeft className="size-4" /> {t.backToCheckout}
        </Button>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" /> {t.gatewayNote}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CreditCard className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {t.orderPaymentTitle.replace('{orderNumber}', orderNumber)}
          </h1>
          <p className="text-sm text-muted-foreground">{t.cardPaymentSubtitle}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t.cardNumber}</Label>
          <Input placeholder="0000 0000 0000 0000" inputMode="numeric" defaultValue="4242 4242 4242 4242" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t.cardExpiry}</Label>
            <Input placeholder="MM/YY" defaultValue="12/28" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t.cardCvv}</Label>
            <Input placeholder="123" defaultValue="123" />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">{t.toPay}</span>
        <span className="text-xl font-bold text-foreground">{formatPrice(total)}</span>
      </div>

      <Button size="lg" className="mt-5 w-full gap-2" onClick={handlePay} disabled={processing}>
        {processing ? (
          <>
            <Loader2 className="size-4 animate-spin" /> {t.processing}
          </>
        ) : (
          <>
            {t.payButton} {formatPrice(total)}
          </>
        )}
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="mt-2 w-full gap-2 text-muted-foreground"
        onClick={() => router.push('/checkout')}
        disabled={processing}
      >
        <ArrowLeft className="size-4" /> {t.backToCheckout}
      </Button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> {t.demoNote}
      </p>
    </div>
  )
}
