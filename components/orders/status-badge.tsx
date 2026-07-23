'use client'

import { cn } from '@/lib/utils'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { getOrderStatusLabel, getPaymentStatusLabel } from '@/lib/order-status'

const STATUS_CLASSNAMES: Record<string, string> = {
  new: 'bg-info/15 text-info border-info/30',
  accepted: 'bg-primary/15 text-primary border-primary/30',
  processing: 'bg-warning/15 text-warning border-warning/30',
  shipped: 'bg-info/15 text-info border-info/30',
  done: 'bg-success/15 text-success border-success/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
}

const PAYMENT_CLASSNAMES: Record<string, string> = {
  unpaid: 'bg-muted text-muted-foreground border-border',
  paid: 'bg-success/15 text-success border-success/30',
  refunded: 'bg-destructive/15 text-destructive border-destructive/30',
}

export function StatusBadge({ status }: { status: string }) {
  const { locale } = useAdminI18n()
  const label = getOrderStatusLabel(status, locale)
  const className = STATUS_CLASSNAMES[status] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}

export function PaymentBadge({ status }: { status: string }) {
  const { locale } = useAdminI18n()
  const label = getPaymentStatusLabel(status, locale)
  const className = PAYMENT_CLASSNAMES[status] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  )
}
