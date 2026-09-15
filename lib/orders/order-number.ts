import { randomInt } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders } from '@/lib/db/schema'

// SECURITY: order numbers used to double as the only access token for guest
// confirmation/pay pages. Those pages now also require the pf_last_order
// cookie (or a logged-in owner) — see getOrderByNumber() — but the number
// is still shown in emails/UI and guessed numbers must not collide. The old
// 9-digit range (1e8..1e9, ~900M values) meant a store with a few thousand
// orders could realistically collide or be brute-forced. 12 digits (~9e11
// values) plus `randomInt` (CSPRNG) keeps that infeasible. Kept as plain
// digits so it stays easy to read/dictate over the phone and every existing
// ilike-search / regex assumption on this column keeps working unchanged.
function randomOrderNumber() {
  return randomInt(100_000_000_000, 999_999_999_999).toString()
}

// `orders.order_number` is unique in the DB, but a random candidate can
// (rarely) collide, which used to surface as an unhandled unique-constraint
// violation and crash order creation for a real customer. Retry a few times
// against the DB, then fall back to a value that's unique by construction
// (timestamp + random suffix) so this can never hard-fail.
export async function generateUniqueOrderNumber(maxAttempts = 5): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = randomOrderNumber()
    const [existing] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, candidate))
      .limit(1)
    if (!existing) return candidate
  }
  return `${Date.now()}${randomInt(100)}`
}
