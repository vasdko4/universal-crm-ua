import { cn } from '@/lib/utils'

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  new: { label: 'Новый', className: 'bg-info/15 text-info border-info/30' },
  accepted: { label: 'Принят', className: 'bg-primary/15 text-primary border-primary/30' },
  processing: { label: 'В обработке', className: 'bg-warning/15 text-warning border-warning/30' },
  shipped: { label: 'Отправлен', className: 'bg-info/15 text-info border-info/30' },
  done: { label: 'Выполнен', className: 'bg-success/15 text-success border-success/30' },
  cancelled: { label: 'Отменён', className: 'bg-destructive/15 text-destructive border-destructive/30' },
}

const PAYMENT_MAP: Record<string, { label: string; className: string }> = {
  unpaid: { label: 'Не оплачен', className: 'bg-muted text-muted-foreground border-border' },
  paid: { label: 'Оплачен', className: 'bg-success/15 text-success border-success/30' },
  refunded: { label: 'Возврат', className: 'bg-destructive/15 text-destructive border-destructive/30' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', s.className)}>
      {s.label}
    </span>
  )
}

export function PaymentBadge({ status }: { status: string }) {
  const s = PAYMENT_MAP[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', s.className)}>
      {s.label}
    </span>
  )
}
