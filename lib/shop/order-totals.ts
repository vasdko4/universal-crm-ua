/**
 * Single formula for order money so the admin builder and the storefront
 * checkout cannot drift (H7). Delivery is 0 on the storefront until carrier
 * quotes exist; the admin path still records a typed delivery cost.
 */
export function computeOrderTotals(input: {
  itemsTotal: number
  deliveryCost?: number
  discount?: number
}): {
  itemsTotal: number
  deliveryCost: number
  discount: number
  total: number
} {
  const itemsTotal = Number.isFinite(input.itemsTotal) ? Math.max(0, input.itemsTotal) : 0
  const deliveryCost = Number.isFinite(input.deliveryCost) ? Math.max(0, input.deliveryCost ?? 0) : 0
  const rawDiscount = Number.isFinite(input.discount) ? Math.max(0, input.discount ?? 0) : 0
  const discount = Math.min(rawDiscount, itemsTotal)
  return {
    itemsTotal,
    deliveryCost,
    discount,
    total: Math.max(0, itemsTotal - discount + deliveryCost),
  }
}
