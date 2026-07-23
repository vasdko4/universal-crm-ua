import type { Locale } from '@/lib/i18n/config'

export const ORDER_STATUSES = [
  { value: 'pending_payment', label: 'Ожидает оплаты', color: 'amber' },
  { value: 'new', label: 'Новый', color: 'blue' },
  { value: 'accepted', label: 'Принят', color: 'violet' },
  { value: 'processing', label: 'В обработке', color: 'amber' },
  { value: 'shipped', label: 'Отправлен', color: 'cyan' },
  { value: 'done', label: 'Выполнен', color: 'green' },
  { value: 'cancelled', label: 'Отменён', color: 'red' },
] as const

export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'Не оплачен' },
  { value: 'paid', label: 'Оплачен' },
  { value: 'refunded', label: 'Возврат' },
] as const

// Ukrainian labels for the storefront (admin uses the Russian labels above).
export const ORDER_STATUS_LABELS_UK: Record<string, string> = {
  pending_payment: 'Очікує оплати',
  new: 'Новий',
  accepted: 'Прийнято',
  processing: 'В обробці',
  shipped: 'Відправлено',
  done: 'Виконано',
  cancelled: 'Скасовано',
}

export const PAYMENT_STATUS_LABELS_UK: Record<string, string> = {
  unpaid: 'Не оплачено',
  paid: 'Оплачено',
  refunded: 'Повернення',
}

export type OrderStatus = (typeof ORDER_STATUSES)[number]['value']
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]['value']

/** Admin-panel order status label in the given locale (admin default is Russian). */
export function getOrderStatusLabel(status: string, locale: Locale): string {
  if (locale === 'uk') return ORDER_STATUS_LABELS_UK[status] ?? status
  return ORDER_STATUSES.find((s) => s.value === status)?.label ?? status
}

export function getOrderStatusOptions(locale: Locale): { value: string; label: string }[] {
  return ORDER_STATUSES.map((s) => ({ value: s.value, label: getOrderStatusLabel(s.value, locale) }))
}

export function getPaymentStatusLabel(status: string, locale: Locale): string {
  if (locale === 'uk') return PAYMENT_STATUS_LABELS_UK[status] ?? status
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
}

const PAYMENT_METHOD_LABELS_UK: Record<string, string> = {
  online: 'Онлайн-оплата',
  cod: 'Накладений платіж',
  prepay: 'Передоплата на картку',
  cash: 'Готівка',
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
  name: string
  sku?: string
  image?: string
  price: number
  quantity: number
}

export type OrderListParams = {
  search?: string
  status?: string
  page?: number
  perPage?: number
}
