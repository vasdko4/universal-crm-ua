import { Truck, Mail, Wallet, CreditCard, FileText, Package } from 'lucide-react'

export type SafeMethod = { code: string; name: string }

// Icon per known method code. Falls back to a generic package/wallet icon for
// any future code added in the admin center, so this never needs to change
// just because a new delivery/payment method gets configured.
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

// Shows the store's actually-configured active delivery + payment methods on
// the product page (names come straight from the admin center, e.g. "Нова
// Пошта", "Оплата при отриманні"), instead of generic marketing copy. Renders
// nothing if the store hasn't set anything up (e.g. brand-new install).
export function PaymentDeliveryBadges({
  delivery,
  payment,
}: {
  delivery: SafeMethod[]
  payment: SafeMethod[]
}) {
  if (delivery.length === 0 && payment.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
      {delivery.map((d) => (
        <Badge key={`d-${d.code}`} Icon={DELIVERY_ICONS[d.code] ?? Package} label={d.name} />
      ))}
      {payment.map((p) => (
        <Badge key={`p-${p.code}`} Icon={PAYMENT_ICONS[p.code] ?? Wallet} label={p.name} />
      ))}
    </div>
  )
}
