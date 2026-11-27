import { db, dbForClient } from '@/lib/db'
import { promotions, promotionUsages, promotionReservations, orderHistory } from '@/lib/db/schema'
import * as schema from '@/lib/db/schema'
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { revalidatePath } from 'next/cache'
import type { PoolClient } from 'pg'

/**
 * How long a reserved promo slot is held while its order sits unpaid.
 * 45 minutes — the same window lib/payments/expire-pending.ts allows an
 * online order to stay `pending_payment` (DEFAULT_MAX_AGE_MINUTES = 45)
 * before it is probed and cancelled. A reservation can therefore never
 * outlive the order it belongs to, and abandoned checkouts cannot hoard
 * slots past the point the order itself would be cancelled.
 */
export const PROMO_RESERVATION_TTL_MINUTES = 45

/** A drizzle executor: `db` itself, `dbForClient(client)` inside a caller
 * transaction, or a `db.transaction()` tx. Typed structurally as only the
 * four executor methods the helpers use — `typeof db` would reject the
 * other two (its `$client` is `Pool`, not `PoolClient`, and a transaction
 * is a PgTransaction, not the db type). */
export type PromoTx = Pick<NodePgDatabase<typeof schema>, 'update' | 'insert' | 'select' | 'delete'>

/**
 * The single gate for promo slots (3.4.109): atomically bumps `usedCount`
 * by 1 iff the promotion is unlimited or still under its `usageLimit`.
 * No ledger row, no totals — the caller decides when the redemption is
 * recorded (at reserve time the slot is only held; at consume time the
 * ledger + totals are written without a second bump). Returns true iff
 * the slot was taken. This is the ONLY conditional UPDATE in the module —
 * reserve, legacy claim and the wrapper below all go through it, so there
 * is exactly one place where a slot can be taken.
 */
export async function claimPromoSlotTx(tx: PromoTx, promotionId: number): Promise<boolean> {
  const [updated] = await tx
    .update(promotions)
    .set({
      usedCount: sql`${promotions.usedCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(promotions.id, promotionId),
        sql`(${promotions.usageLimit} IS NULL OR ${promotions.usedCount} < ${promotions.usageLimit})`,
      ),
    )
    .returning({ id: promotions.id })
  return Boolean(updated)
}

/** claimPromoSlotTx without a caller transaction: one statement, atomic alone. */
export async function claimPromoSlot(promotionId: number, client?: PoolClient): Promise<boolean> {
  if (client) return claimPromoSlotTx(dbForClient(client), promotionId)
  return claimPromoSlotTx(db, promotionId)
}

/**
 * Ledger half of the split: writes the `promotion_usages` row and adds the
 * order/discount amounts to the promotion totals. No counter change — the
 * slot must already have been taken (by claimPromoSlotTx at reserve/claim
 * time, or by an existing reservation being consumed).
 */
export async function recordPromoLedgerTx(
  tx: PromoTx,
  input: {
    promotionId: number
    orderReference?: string
    orderAmount: number
    discountAmount: number
  },
): Promise<void> {
  await tx.insert(promotionUsages).values({
    promotionId: input.promotionId,
    orderReference: input.orderReference ?? null,
    orderAmount: String(input.orderAmount),
    discountAmount: String(input.discountAmount),
  })
  await tx
    .update(promotions)
    .set({
      totalOrdersAmount: sql`${promotions.totalOrdersAmount} + ${input.orderAmount}`,
      totalDiscountAmount: sql`${promotions.totalDiscountAmount} + ${input.discountAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(promotions.id, input.promotionId))
}

/** recordPromoLedgerTx without a caller transaction (own transaction). */
export async function recordPromoLedger(
  input: {
    promotionId: number
    orderReference?: string
    orderAmount: number
    discountAmount: number
  },
  client?: PoolClient,
): Promise<void> {
  if (client) return recordPromoLedgerTx(dbForClient(client), input)
  await db.transaction(async (tx) => recordPromoLedgerTx(tx, input))
}

/**
 * Records that a promotion was applied to an order: the combined
 * claim-then-record path, kept for legacy callers (the admin
 * `recordPromotionUsage` action in app/actions/promotions.ts). New code
 * uses the split halves — `claimPromoSlotTx` (the single conditional
 * UPDATE gate) and `recordPromoLedgerTx` (ledger + totals, no counter
 * change) — so a slot can be held at reserve time and recorded at consume
 * time without a second bump. Server-only — never export this from a
 * 'use server' file.
 *
 * When `client` is the checkout transaction, the increment lives on the
 * same connection as the order insert (FIX-11). Without it, a parallel
 * order can keep the discount after this one rolls back.
 */
export async function recordPromotionUsageInternal(
  input: {
    promotionId: number
    orderReference?: string
    orderAmount: number
    discountAmount: number
  },
  client?: PoolClient,
): Promise<{ success: boolean; counted: boolean }> {
  // The ledger row is written only when the counter bump actually happened:
  // an uncounted usage (limit reached) used to be recorded anyway, and the
  // release path then freed a slot that was never taken.
  let counted: boolean
  if (client) {
    const tx = dbForClient(client)
    counted = await claimPromoSlotTx(tx, input.promotionId)
    if (counted) await recordPromoLedgerTx(tx, input)
  } else {
    counted = await db.transaction(async (tx) => {
      const c = await claimPromoSlotTx(tx, input.promotionId)
      if (c) await recordPromoLedgerTx(tx, input)
      return c
    })
  }

  revalidatePath('/admin/promotions')
  return { success: true, counted }
}

export type OrderPromoFields = {
  orderId: number
  orderNumber: string
  customerName?: string | null
  promoCode?: string | null
  discountTotal?: string | number | null
  autoDiscountId?: number | null
  autoDiscountAmount?: string | number | null
  total?: string | number | null
}

export type PromoLeg = {
  promotionId: number
  kind: 'promocode' | 'auto'
  /** Manual leg: the code as typed; auto leg: 'auto'. */
  label: string
  amount: number
  orderAmount: number
  /**
   * usageLimit of the promotion row: null = unlimited (no reservation);
   * undefined = the promotion row is missing (auto leg only — the manual
   * leg is skipped outright when its code matches nothing).
   */
  usageLimit?: number | null
}

/**
 * The promo legs of an order, from its stored fields — the same derivation
 * recordPromoUsageForOrder always used (manual amount = discountTotal minus
 * the auto slice). A leg with amount 0 is not a redemption and takes no slot.
 */
async function resolvePromoLegs(tx: PromoTx, order: OrderPromoFields): Promise<PromoLeg[]> {
  const total = Number(order.total ?? 0)
  const totalDiscount = Number(order.discountTotal ?? 0)
  const autoAmount = Number(order.autoDiscountAmount ?? 0)
  const manualAmount = Math.max(0, totalDiscount - autoAmount)
  const legs: PromoLeg[] = []

  if (order.promoCode && manualAmount > 0) {
    const [promo] = await tx
      .select({ id: promotions.id, usageLimit: promotions.usageLimit })
      .from(promotions)
      .where(
        sql`UPPER(${promotions.promoCode}) = ${order.promoCode.toUpperCase()} AND ${promotions.type} = 'promocode'`,
      )
      .orderBy(asc(promotions.id))
      .limit(1)
    if (promo) {
      legs.push({
        promotionId: promo.id,
        kind: 'promocode',
        label: order.promoCode,
        amount: manualAmount,
        orderAmount: total,
        usageLimit: promo.usageLimit,
      })
    }
  }

  if (order.autoDiscountId && autoAmount > 0) {
    const [promo] = await tx
      .select({ id: promotions.id, usageLimit: promotions.usageLimit })
      .from(promotions)
      .where(eq(promotions.id, Number(order.autoDiscountId)))
      .limit(1)
    legs.push({
      promotionId: Number(order.autoDiscountId),
      kind: 'auto',
      label: 'auto',
      amount: autoAmount,
      orderAmount: total,
      usageLimit: promo?.usageLimit,
    })
  }

  return legs
}

/**
 * Lazy-reaps expired active reservations for one promotion: status ->
 * 'expired' (rows are never DELETE-d — they are the audit trail) and one
 * `usedCount` decrement per reaped row, in the caller's transaction.
 * This is the primary expiry mechanism: an expired hold frees its slot at
 * the next reserve/consume/release attempt for the same promotion, with no
 * cron dependency. Returns the number of rows reaped.
 */
export async function reapExpiredReservationsTx(tx: PromoTx, promotionId: number): Promise<number> {
  const reaped = await tx
    .update(promotionReservations)
    .set({ status: 'expired' })
    .where(
      and(
        eq(promotionReservations.promotionId, promotionId),
        eq(promotionReservations.status, 'active'),
        lt(promotionReservations.expiresAt, new Date()),
      ),
    )
    .returning({ id: promotionReservations.id })
  for (const row of reaped) {
    await tx
      .update(promotions)
      .set({
        usedCount: sql`GREATEST(${promotions.usedCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, promotionId))
  }
  return reaped.length
}

/**
 * Backstop sweeper for the expire-pending cron: reaps expired active
 * reservations across ALL promotions (lazy reap only covers the promotion
 * of the next checkout attempt). Returns the number of holds swept.
 */
export async function sweepExpiredReservations(client?: PoolClient): Promise<{ swept: number }> {
  const run = async (tx: PromoTx) => {
    const expired = await tx
      .select({ promotionId: promotionReservations.promotionId })
      .from(promotionReservations)
      .where(
        and(
          eq(promotionReservations.status, 'active'),
          lt(promotionReservations.expiresAt, new Date()),
        ),
      )
    let swept = 0
    for (const promotionId of new Set(expired.map((r) => r.promotionId))) {
      swept += await reapExpiredReservationsTx(tx, promotionId)
    }
    return { swept }
  }
  if (client) return run(dbForClient(client))
  return db.transaction(run)
}

async function reserveLegTx(
  tx: PromoTx,
  order: OrderPromoFields,
  leg: PromoLeg,
  strict: boolean,
): Promise<'reserved' | 'skipped-unlimited' | 'missed'> {
  // Unlimited promotions hold no slot (design §2.1) — there is nothing to protect.
  if (leg.usageLimit === null) return 'skipped-unlimited'
  // Lazy-reap first so a dead hold never blocks a live buyer.
  await reapExpiredReservationsTx(tx, leg.promotionId)
  // Idempotent re-reserve: an order that already holds a live slot for this
  // promotion (retry inside the same flow) must not take a second one.
  const [existing] = await tx
    .select({ id: promotionReservations.id })
    .from(promotionReservations)
    .where(
      and(
        eq(promotionReservations.promotionId, leg.promotionId),
        eq(promotionReservations.orderNumber, order.orderNumber),
        eq(promotionReservations.status, 'active'),
      ),
    )
    .limit(1)
  if (existing) return 'reserved'
  // The single gate: the same conditional UPDATE the legacy claim uses.
  // 0 rows means the limit was taken (by another order's reservation or
  // redemption) — with strict=true the caller aborts the whole order
  // before any money moves.
  const claimed = await claimPromoSlotTx(tx, leg.promotionId)
  if (!claimed) {
    if (strict) throw new Error('promo-limit')
    return 'missed'
  }
  try {
    // Slot only: no discount/order amounts are snapshotted here (design
    // §2.1) — at consume time the order's current promo fields win.
    await tx.insert(promotionReservations).values({
      promotionId: leg.promotionId,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      status: 'active',
      expiresAt: new Date(Date.now() + PROMO_RESERVATION_TTL_MINUTES * 60_000),
    })
  } catch (e) {
    // A concurrent reserve for the same (promotion, order) won the partial
    // unique index: give back the slot this claim just took and reuse theirs.
    if ((e as { code?: string })?.code === '23505') {
      await tx
        .update(promotions)
        .set({
          usedCount: sql`GREATEST(${promotions.usedCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(promotions.id, leg.promotionId))
      return 'reserved'
    }
    throw e
  }
  return 'reserved'
}

/**
 * Reserves the promo slots for an order (3.4.109): lazy-reaps expired holds,
 * claims one slot per leg through the single conditional-UPDATE gate, and
 * inserts one `active` reservation row per claimed leg.
 *
 * Called from createStorefrontOrder INSIDE the order-creation transaction,
 * on the same client as the order insert (FIX-11): a pool connection cannot
 * see the uncommitted order, and a rollback must not leave an orphaned
 * hold. Cash/requisite orders consume the reservation in the same
 * transaction, right after, via applyOrderFulfillment — one code path, no
 * window where a hold could leak.
 *
 * Atomic: with a client everything runs on the caller's transaction, so a
 * limit miss on the second leg rolls the first leg's claim + reservation
 * back; without one this opens its own transaction. Unlimited promotions
 * (usageLimit IS NULL) are skipped — there is no slot to protect — and
 * one-click orders (discountTotal 0) have no legs at all.
 */
export async function reservePromoUsageForOrder(
  order: OrderPromoFields,
  client?: PoolClient,
  opts?: { strict?: boolean },
): Promise<{ reserved: number[]; skippedUnlimited: number[]; missed: number[] }> {
  const strict = opts?.strict ?? true
  const run = async (tx: PromoTx) => {
    const legs = await resolvePromoLegs(tx, order)
    const reserved: number[] = []
    const skippedUnlimited: number[] = []
    const missed: number[] = []
    for (const leg of legs) {
      const outcome = await reserveLegTx(tx, order, leg, strict)
      if (outcome === 'reserved') reserved.push(leg.promotionId)
      else if (outcome === 'skipped-unlimited') skippedUnlimited.push(leg.promotionId)
      else missed.push(leg.promotionId)
    }
    return { reserved, skippedUnlimited, missed }
  }
  if (client) return run(dbForClient(client))
  return db.transaction(run)
}

/**
 * Converts this order's live reservations into recorded redemptions, one
 * leg at a time: status -> 'consumed', ledger row + totals from the ORDER's
 * current amounts (the reservation holds the slot only, so an admin edit
 * between creation and payment is honoured). `usedCount` is NOT bumped
 * again — it was bumped at reserve time. A reservation that already
 * expired (payment arrived after the TTL) is NOT consumed here: the
 * caller falls back to the legacy claim, which re-competes for the slot
 * and logs on a miss. Returns the consumed promotion ids.
 */
async function consumePromoReservationsTx(
  tx: PromoTx,
  order: OrderPromoFields,
  legs: PromoLeg[],
): Promise<number[]> {
  const consumed: number[] = []
  for (const leg of legs) {
    // Reap first so an expired hold is 'expired' (slot freed) instead of
    // being consumed after its TTL.
    await reapExpiredReservationsTx(tx, leg.promotionId)
    const [reservation] = await tx
      .update(promotionReservations)
      .set({ status: 'consumed', consumedAt: new Date() })
      .where(
        and(
          eq(promotionReservations.promotionId, leg.promotionId),
          eq(promotionReservations.orderNumber, order.orderNumber),
          eq(promotionReservations.status, 'active'),
          gt(promotionReservations.expiresAt, new Date()),
        ),
      )
      .returning({ id: promotionReservations.id })
    if (!reservation) continue
    await recordPromoLedgerTx(tx, {
      promotionId: leg.promotionId,
      orderReference: order.orderNumber,
      orderAmount: leg.orderAmount,
      discountAmount: leg.amount,
    })
    consumed.push(leg.promotionId)
  }
  return consumed
}

/**
 * Public consume step (see consumePromoReservationsTx): converts the
 * order's live reservations into redemptions. Used by
 * recordPromoUsageForOrder; callers that already hold a transaction pass
 * its client so the conversion commits (or rolls back) with them.
 */
export async function consumePromoReservation(
  order: OrderPromoFields,
  client?: PoolClient,
): Promise<{ consumed: number[] }> {
  const run = async (tx: PromoTx) => {
    const legs = await resolvePromoLegs(tx, order)
    return { consumed: await consumePromoReservationsTx(tx, order, legs) }
  }
  if (client) return run(dbForClient(client))
  return db.transaction(run)
}

/**
 * Releases this order's active reservations for promotions that are no
 * longer among its processed legs (an admin edited the code off the order
 * after creation): status -> 'released', one `usedCount` decrement each.
 */
async function releaseStaleReservationsTx(
  tx: PromoTx,
  orderNumber: string,
  keepPromotionIds: Set<number>,
): Promise<void> {
  const stale = await tx
    .select({ id: promotionReservations.id, promotionId: promotionReservations.promotionId })
    .from(promotionReservations)
    .where(
      and(
        eq(promotionReservations.orderNumber, orderNumber),
        eq(promotionReservations.status, 'active'),
      ),
    )
  for (const row of stale) {
    if (keepPromotionIds.has(row.promotionId)) continue
    await tx
      .update(promotionReservations)
      .set({ status: 'released', releasedAt: new Date() })
      .where(eq(promotionReservations.id, row.id))
    await tx
      .update(promotions)
      .set({
        usedCount: sql`GREATEST(${promotions.usedCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, row.promotionId))
  }
}

/**
 * Records promo usage for an order from its stored promo fields.
 * Extracted from applyOrderFulfillment (identical semantics) so the admin
 * "reopen cancelled order" path can re-claim usage the same way checkout
 * claims it.
 *
 * 3.4.109 — "consume reservation if one exists, else legacy claim":
 * a live reservation for the order is converted (ledger + totals from the
 * order's current amounts, no second `usedCount` bump); only when no
 * reservation exists does the legacy claim run (conditional UPDATE now,
 * ledger on success). The non-strict branch therefore covers "no
 * reservation exists" (legacy order, or a reservation that expired before
 * payment) — it no longer means "limit exhausted on a paid order", which
 * the reservation at creation time now prevents.
 *
 * strict=true (inside the checkout transaction): a missed limit bump aborts
 * the flow with 'promo-limit', exactly as before. strict=false (reopen /
 * finalize of a legacy order): the miss is logged to order history instead
 * of failing, and the order keeps its discount without consuming a slot.
 */
export async function recordPromoUsageForOrder(
  order: OrderPromoFields,
  client?: PoolClient,
  opts?: { strict?: boolean },
): Promise<void> {
  const strict = opts?.strict ?? false
  const run = async (tx: PromoTx) => {
    const legs = await resolvePromoLegs(tx, order)
    const consumed = new Set(await consumePromoReservationsTx(tx, order, legs))
    const processedPromotionIds = new Set<number>(consumed)
    const actor = order.customerName ?? 'System'

    for (const leg of legs) {
      const historyMessage = (counted: boolean) =>
        leg.kind === 'promocode'
          ? counted
            ? `Промокод ${leg.label} — ${leg.amount.toFixed(2)} ₴`
            : `Промокод ${leg.label} — не засчитан: лимит исчерпан`
          : counted
            ? `Автознижка — ${leg.amount.toFixed(2)} ₴`
            : `Автознижка — не засчитана: лимит исчерпан`
      if (consumed.has(leg.promotionId)) {
        processedPromotionIds.add(leg.promotionId)
        await tx.insert(orderHistory).values({
          orderId: order.orderId,
          type: 'note',
          message: historyMessage(true),
          actor,
        })
        continue
      }
      // No (live) reservation: legacy claim.
      const counted = await claimPromoSlotTx(tx, leg.promotionId)
      if (counted) {
        await recordPromoLedgerTx(tx, {
          promotionId: leg.promotionId,
          orderReference: order.orderNumber,
          orderAmount: leg.orderAmount,
          discountAmount: leg.amount,
        })
        processedPromotionIds.add(leg.promotionId)
      } else if (strict) {
        throw new Error('promo-limit')
      }
      await tx.insert(orderHistory).values({
        orderId: order.orderId,
        type: 'note',
        message: historyMessage(counted),
        actor,
      })
    }

    // A reservation can outlive the promo on the order (an admin edited the
    // code off after creation): release the orphaned hold so it never
    // blocks the slot past its TTL.
    await releaseStaleReservationsTx(tx, order.orderNumber, processedPromotionIds)
  }
  if (client) await run(dbForClient(client))
  else await db.transaction(run)
}

/**
 * Releases the ACTIVE reservations of an order (cancel / failed or expired
 * payment / full refund): status -> 'released' and one `usedCount`
 * decrement per released hold, in the caller's transaction. Consumed
 * reservations are untouched — their slot is freed by the ledger release
 * in releasePromotionUsageForOrder instead. An already-expired hold is
 * marked 'expired', not 'released' (lazy reap runs first).
 * Idempotent: with no active reservation it is a no-op.
 */
async function releaseReservationsTx(
  tx: PromoTx,
  orderReference: string,
): Promise<Array<{ promotionId: number; promoCode: string | null }>> {
  // Lazy-reap first: expired holds are 'expired', not 'released'.
  const expired = await tx
    .select({ promotionId: promotionReservations.promotionId })
    .from(promotionReservations)
    .where(
      and(
        eq(promotionReservations.orderNumber, orderReference),
        eq(promotionReservations.status, 'active'),
        lt(promotionReservations.expiresAt, new Date()),
      ),
    )
  for (const promotionId of new Set(expired.map((r) => r.promotionId))) {
    await reapExpiredReservationsTx(tx, promotionId)
  }
  const active = await tx
    .select({ id: promotionReservations.id, promotionId: promotionReservations.promotionId })
    .from(promotionReservations)
    .where(
      and(
        eq(promotionReservations.orderNumber, orderReference),
        eq(promotionReservations.status, 'active'),
      ),
    )
  const released: Array<{ promotionId: number; promoCode: string | null }> = []
  for (const row of active) {
    await tx
      .update(promotionReservations)
      .set({ status: 'released', releasedAt: new Date() })
      .where(eq(promotionReservations.id, row.id))
    const [promo] = await tx
      .update(promotions)
      .set({
        usedCount: sql`GREATEST(${promotions.usedCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, row.promotionId))
      .returning({ promoCode: promotions.promoCode })
    released.push({ promotionId: row.promotionId, promoCode: promo?.promoCode ?? null })
  }
  return released
}

/** Public release step (see releaseReservationsTx). */
export async function releasePromoReservationForOrder(
  orderReference: string,
  client?: PoolClient,
): Promise<{ released: Array<{ promotionId: number; promoCode: string | null }> }> {
  const released = client
    ? await releaseReservationsTx(dbForClient(client), orderReference)
    : await db.transaction((tx) => releaseReservationsTx(tx, orderReference))
  revalidatePath('/admin/promotions')
  return { released }
}

/**
 * Releases promo usage recorded for an order: deletes its ledger rows and
 * reverses the promotion counters (usedCount, totals), floored at zero so a
 * retry can never drive them negative. 3.4.109: also releases the order's
 * still-active reservations (same transaction) — a cancelled unpaid order
 * never reached the ledger, so without this its held slot would stay
 * taken until the lazy reap.
 *
 * Called on order cancel and on FULL refund — the sale is voided, so the
 * promo-code slot is freed for reuse. Partial refunds keep the usage: the
 * order is still active with the discount applied.
 *
 * Idempotent: with no ledger rows and no active reservation for the order
 * reference it is a no-op, so cancel→refund or double-cancel sequences
 * can't double-decrement. A consumed reservation is not active, so its
 * slot is freed by the ledger path only — never twice.
 */
export async function releasePromotionUsageForOrder(
  orderReference: string,
  client?: PoolClient,
): Promise<{ released: Array<{ promotionId: number; promoCode: string | null }> }> {
  // With a client the caller owns the transaction; without one, the DELETE +
  // UPDATEs must still be atomic — otherwise a crash between them loses the
  // promo slot forever (ledger row gone, counter never decremented).
  const run = async (tx: PromoTx) => {
    const released = await releaseWith(tx, orderReference)
    const reservations = await releaseReservationsTx(tx, orderReference)
    // A promotion appears at most once across the two (a consumed
    // reservation is not active); dedupe defensively so a history message
    // never lists the same code twice.
    const seen = new Set(released.map((r) => r.promotionId))
    for (const row of reservations) {
      if (!seen.has(row.promotionId)) {
        released.push(row)
        seen.add(row.promotionId)
      }
    }
    return { released }
  }
  const result = client
    ? await run(dbForClient(client))
    : await db.transaction(run)
  revalidatePath('/admin/promotions')
  return result
}

async function releaseWith(
  tx: PromoTx,
  orderReference: string,
): Promise<Array<{ promotionId: number; promoCode: string | null }>> {
  const rows = await tx
    .delete(promotionUsages)
    .where(eq(promotionUsages.orderReference, orderReference))
    .returning({
      promotionId: promotionUsages.promotionId,
      orderAmount: promotionUsages.orderAmount,
      discountAmount: promotionUsages.discountAmount,
    })
  if (rows.length === 0) return []

  const released: Array<{ promotionId: number; promoCode: string | null }> = []
  for (const row of rows) {
    const [promo] = await tx
      .update(promotions)
      .set({
        usedCount: sql`GREATEST(${promotions.usedCount} - 1, 0)`,
        totalOrdersAmount: sql`GREATEST(${promotions.totalOrdersAmount} - ${row.orderAmount}::numeric, 0)`,
        totalDiscountAmount: sql`GREATEST(${promotions.totalDiscountAmount} - ${row.discountAmount}::numeric, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(promotions.id, row.promotionId))
      .returning({ promoCode: promotions.promoCode })
    released.push({ promotionId: row.promotionId, promoCode: promo?.promoCode ?? null })
  }

  return released
}
