import type { Locale } from '@/lib/i18n/config'
import { ORDER_STATUSES, getOrderStatusLabel, getPaymentStatusLabel } from '@/lib/order-status'
import { cn } from '@/lib/utils'

const BASE_BADGE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset'

/** Tailwind classes for each named status color used in lib/order-status. */
const COLOR_CLASSES: Record<string, string> = {
  amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-400',
  blue: 'bg-blue-500/10 text-blue-700 ring-blue-500/25 dark:text-blue-400',
  violet: 'bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-400',
  cyan: 'bg-cyan-500/10 text-cyan-700 ring-cyan-500/25 dark:text-cyan-400',
  green: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400',
  red: 'bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-400',
  gray: 'bg-muted text-muted-foreground ring-border',
}

/** Badge color classes for an order status value. Unknown statuses fall back to gray. */
export function orderStatusBadgeClass(status: string): string {
  const color = ORDER_STATUSES.find((s) => s.value === status)?.color ?? 'gray'
  return COLOR_CLASSES[color] ?? COLOR_CLASSES.gray
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'amber',
  paid: 'green',
  partially_refunded: 'blue',
  refunded: 'gray',
}

/** Badge color classes for a payment status value. Unknown statuses fall back to gray. */
export function paymentStatusBadgeClass(status: string): string {
  const color = PAYMENT_STATUS_COLORS[status] ?? 'gray'
  return COLOR_CLASSES[color] ?? COLOR_CLASSES.gray
}

export function OrderStatusBadge({ status, locale }: { status: string; locale: Locale }) {
  return (
    <span className={cn(BASE_BADGE, orderStatusBadgeClass(status))}>
      {getOrderStatusLabel(status, locale)}
    </span>
  )
}

export function PaymentStatusBadge({ status, locale }: { status: string; locale: Locale }) {
  return (
    <span className={cn(BASE_BADGE, paymentStatusBadgeClass(status))}>
      {getPaymentStatusLabel(status, locale)}
    </span>
  )
}
