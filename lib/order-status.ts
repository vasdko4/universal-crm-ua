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
