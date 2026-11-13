import { getMyOrders } from '@/app/actions/shop'
import { fail, ok } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'
import { getShopUser } from '@/lib/session'

/**
 * Logged-in customer's order history for the store REST API v1
 * (Android shop app).
 *
 * GET /api/v1/me/orders
 *
 * Auth: the Better Auth session cookie — the app sends the same cookie the
 * website uses (no token scheme is invented here). getShopUser() returns
 * null without a session, and the route answers 401 (getMyOrders itself
 * would silently return [] for a guest, so auth is checked explicitly).
 * NOTE: Better Auth sessions are bound to the IP /24 and the exact
 * User-Agent they were created with (see lib/session validateSessionBinding)
 * — the app must send a stable User-Agent across requests or the session
 * is killed and the user has to sign in again.
 *
 * The shape is the account page's own (getMyOrders): order id, number,
 * status, payment status, date, total, items with prices, product slugs,
 * item count. No gateway data, no internal notes.
 */
export async function GET(request: Request) {
  if (await isRateLimited('api-v1-me-orders', clientIp(request), 60)) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const user = await getShopUser()
  if (!user) return fail('Не авторизован', 401)

  const orders = await getMyOrders()
  return ok({
    items: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt ? order.createdAt.toISOString() : null,
      total: Number(order.total),
      itemsCount: order.itemsCount,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        image: item.image,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.total),
        variantLabel: item.variantLabel,
      })),
      productSlugs: order.productSlugs,
    })),
    total: orders.length,
  })
}
