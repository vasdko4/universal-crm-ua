import { pool } from '@/lib/db'

export type StockReason = 'sale' | 'cancel' | 'adjust' | 'bulk' | 'import' | 'restore'

export async function recordStockMovement(input: {
  productId: number
  variantId?: number | null
  delta: number
  quantityAfter?: number | null
  reason: StockReason
  orderId?: number | null
  actor?: string | null
  note?: string | null
}): Promise<void> {
  await pool
    .query(
      `INSERT INTO stock_movements (product_id, variant_id, delta, quantity_after, reason, order_id, actor, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.productId,
        input.variantId ?? null,
        input.delta,
        input.quantityAfter ?? null,
        input.reason,
        input.orderId ?? null,
        input.actor ?? null,
        input.note ?? null,
      ],
    )
    .catch((e) => console.log('[stock] ledger write failed:', (e as Error).message))
}
