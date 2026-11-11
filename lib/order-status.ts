import type { Locale } from '@/lib/i18n/config'

export const ORDER_STATUSES = [
  { value: 'pending_payment', label: 'Очікує оплати', color: 'amber' },
  { value: 'new', label: 'Новий', color: 'blue' },
  { value: 'accepted', label: 'Прийнято', color: 'violet' },
  { value: 'processing', label: 'В обробці', color: 'amber' },
  { value: 'shipped', label: 'Відправлено', color: 'cyan' },
  { value: 'done', label: 'Виконано', color: 'green' },
  { value: 'cancelled', label: 'Скасовано', color: 'red' },
] as const

export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Очікує оплати' },
  { value: 'paid', label: 'Сплачено' },
  { value: 'partially_refunded', label: 'Часткове повернення' },
  { value: 'refunded', label: 'Повернення' },
] as const

export const ORDER_STATUS_LABELS_RU: Record<string, string> = {
  pending_payment: 'Ожидает оплаты',
  new: 'Новый',
  accepted: 'Принят',
  processing: 'В обработке',
  shipped: 'Отправлен',
  done: 'Выполнен',
  cancelled: 'Отменён',
}

export const PAYMENT_STATUS_LABELS_RU: Record<string, string> = {
  unpaid: 'Ожидает оплаты',
  paid: 'Оплачен',
  partially_refunded: 'Частичный возврат',
  refunded: 'Возврат',
}

/** @deprecated Use ORDER_STATUSES[].label (uk). Kept for storefront callers that still import the name. */
export const ORDER_STATUS_LABELS_UK: Record<string, string> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.value, s.label]),
)

/** @deprecated Use PAYMENT_STATUSES[].label (uk). */
export const PAYMENT_STATUS_LABELS_UK: Record<string, string> = Object.fromEntries(
  PAYMENT_STATUSES.map((s) => [s.value, s.label]),
)

export type OrderStatus = (typeof ORDER_STATUSES)[number]['value']
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]['value']

/**
 * Allowed order-status transitions for the admin action updateOrderStatus.
 * The point is to block the nonsensical ones, not to force a rigid pipeline:
 * an admin may skip steps forward (new → shipped, processing → done) and
 * reopen a cancelled order (cancelled → new, the restore/re-deduct flow).
 * Forbidden: anything out of pending_payment except paid/cancelled (skips
 * payment), anything out of done (terminal), anything back to
 * pending_payment, and anything out of cancelled except reopen.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['new', 'cancelled'],
  new: ['accepted', 'processing', 'shipped', 'done', 'cancelled'],
  accepted: ['processing', 'shipped', 'done', 'cancelled'],
  processing: ['shipped', 'done', 'cancelled'],
  shipped: ['done', 'cancelled'],
  done: [],
  cancelled: ['new'],
}

export function isOrderStatusTransitionAllowed(from: string, to: string): boolean {
  const allowed = (ORDER_STATUS_TRANSITIONS as Record<string, string[]>)[from]
  return Array.isArray(allowed) && allowed.includes(to)
}

/**
 * Allowed payment-status transitions for updateOrderPayment, mirroring
 * ORDER_STATUS_TRANSITIONS (item 54). The point is to block the nonsensical
 * ones: money can only move forward (unpaid -> paid -> refunded), a refunded
 * payment is terminal, and a paid order can never be silently marked unpaid
 * while its stock stays deducted and its promo usage counted. Re-saving the
 * same status is allowed (harmless no-op that still lets a `paid` re-save
 * repair a paid-but-pending_payment order).
 */
export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  unpaid: ['paid'],
  paid: ['partially_refunded', 'refunded'],
  partially_refunded: ['refunded'],
  refunded: [],
}

export function isPaymentStatusTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return true
  const allowed = (PAYMENT_STATUS_TRANSITIONS as Record<string, string[]>)[from]
  return Array.isArray(allowed) && allowed.includes(to)
}

/** Admin-panel order status label. Default locale is Ukrainian. */
export function getOrderStatusLabel(status: string, locale: Locale): string {
  if (locale === 'ru') return ORDER_STATUS_LABELS_RU[status] ?? status
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function getOrderStatusOptions(locale: Locale): { value: string; label: string }[] {
  return ORDER_STATUSES.map((s) => ({ value: s.value, label: getOrderStatusLabel(s.value, locale) }))
}

export function getPaymentStatusLabel(status: string, locale: Locale): string {
  if (locale === 'ru') return PAYMENT_STATUS_LABELS_RU[status] ?? status
  return PAYMENT_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function getPaymentStatusOptions(locale: Locale): { value: string; label: string }[] {
  return PAYMENT_STATUSES.map((s) => ({ value: s.value, label: getPaymentStatusLabel(s.value, locale) }))
}

const PAYMENT_METHOD_LABELS_RU: Record<string, string> = {
  online: 'Онлайн-оплата',
  cod: 'Наложенный платёж',
  prepay: 'Предоплата на карту',
  cash: 'Наличные',
  requisites: 'По реквизитам',
}

const PAYMENT_METHOD_LABELS_UK: Record<string, string> = {
  online: 'Онлайн-оплата',
  cod: 'Накладений платіж',
  prepay: 'Передоплата на картку',
  cash: 'Готівка',
  requisites: 'За реквізитами',
}

export function getPaymentMethodLabel(method: string | null | undefined, locale: Locale): string | null {
  if (!method) return null
  const map = locale === 'uk' ? PAYMENT_METHOD_LABELS_UK : PAYMENT_METHOD_LABELS_RU
  return map[method] ?? method
}

const DELIVERY_METHOD_LABELS_RU: Record<string, string> = {
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
  courier: 'Курьер',
  pickup: 'Самовывоз',
}

const DELIVERY_METHOD_LABELS_UK: Record<string, string> = {
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
  courier: "Кур'єр",
  pickup: 'Самовивіз',
}

export function getDeliveryMethodLabel(method: string | null | undefined, locale: Locale): string | null {
  if (!method) return null
  const map = locale === 'uk' ? DELIVERY_METHOD_LABELS_UK : DELIVERY_METHOD_LABELS_RU
  return map[method] ?? method
}

export type OrderItemInput = {
  productId?: number
  variantId?: number
  variantLabel?: string
  name: string
  sku?: string
  image?: string
  price: number
  quantity: number
}

export type OrderListParams = {
  search?: string
  status?: string
  paymentStatus?: string
  deliveryMethod?: string
  missingTtn?: boolean
  from?: string
  to?: string
  page?: number
  perPage?: number
}
