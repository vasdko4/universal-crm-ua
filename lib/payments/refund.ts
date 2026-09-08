/** Pure remaining-refund math so the admin card and gateway path stay in lockstep. */
export type RefundPlan =
  | { ok: true; amount: number; newRefunded: number; status: 'refunded' | 'partially_refunded' }
  | { ok: false; error: 'none' | 'exceeds' }

export function refundPlan(total: number, alreadyRefunded: number, requested?: number): RefundPlan {
  const tot = Number(total) || 0
  const done = Math.max(0, Number(alreadyRefunded) || 0)
  const remaining = Math.max(0, Number((tot - done).toFixed(2)))
  const amount =
    requested != null && Number.isFinite(requested) && requested > 0
      ? Number(requested.toFixed(2))
      : remaining
  if (amount <= 0) return { ok: false, error: 'none' }
  if (done + amount > tot + 0.001) return { ok: false, error: 'exceeds' }
  const newRefunded = Number((done + amount).toFixed(2))
  const fully = newRefunded >= tot - 0.001
  return {
    ok: true,
    amount,
    newRefunded,
    status: fully ? 'refunded' : 'partially_refunded',
  }
}
