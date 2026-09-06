'use client'

import { Truck, Mail, Wallet, CreditCard, FileText, Package } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'

export type SafeMethod = { code: string; name: string }

const DELIVERY_ICONS: Record<string, typeof Truck> = {
  nova_poshta: Truck,
  ukrposhta: Mail,
}
const PAYMENT_ICONS: Record<string, typeof Wallet> = {
  cod: Wallet,
  online: CreditCard,
  requisites: FileText,
}

function Badge({ Icon, label }: { Icon: typeof Truck; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="size-5 shrink-0 text-primary" />
      <span>{label}</span>
    </div>
  )
}

export function PaymentDeliveryBadges({
  delivery,
  payment,
}: {
  delivery: SafeMethod[]
  payment: SafeMethod[]
}) {
  const { dict } = useI18n()
  const t = dict.checkout
  const label = (code: string, fallback: string) => {
    const map: Record<string, string> = {
      nova_poshta: t.mNovaPoshta,
      ukrposhta: t.mUkrposhta,
      cod: t.mCod,
      online: t.mOnline,
      requisites: t.mRequisites,
    }
    return map[code] ?? fallback
  }

  if (delivery.length === 0 && payment.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
      {delivery.map((d) => (
        <Badge key={`d-${d.code}`} Icon={DELIVERY_ICONS[d.code] ?? Package} label={label(d.code, d.name)} />
      ))}
      {payment.map((p) => (
        <Badge key={`p-${p.code}`} Icon={PAYMENT_ICONS[p.code] ?? Wallet} label={label(p.code, p.name)} />
      ))}
    </div>
  )
}
