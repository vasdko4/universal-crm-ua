import { getMyOrderDetail } from '@/app/actions/shop'
import { fail, ok, parsePositiveInt } from '@/lib/api/helpers'
import { clientIp, isRateLimited } from '@/lib/api/rate-limit'
import { getShopUser } from '@/lib/session'

const NOT_FOUND = 'Замовлення не знайдено'

/**
 * Logged-in customer's order detail for the store REST API v1
 * (Android shop app).
 *
 * GET /api/v1/me/orders/[id] — [id] is the numeric order id (not the order
 * number). Same session-cookie auth as GET /api/v1/me/orders: no session
 * -> 401. The order must belong to the signed-in account (getMyOrderDetail
 * enforces ownership by account only) — anything else is the same 404 as
 * an unknown id, so the endpoint cannot probe other customers' orders.
 *
 * The shape is the account page's own (getMyOrderDetail): order fields,
 * items, product slugs. Two fields are deliberately dropped: `note` (can
 * carry payment-requisite text for bank-transfer orders) and `userId`
 * (internal). No gateway data.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (await isRateLimited('api-v1-me-order', clientIp(request), 60)) {
    return fail('Забагато запитів, спробуйте пізніше', 429)
  }
  const user = await getShopUser()
  if (!user) return fail('Не авторизован', 401)

  const { id } = await params
  const orderId = parsePositiveInt(id)
  if (orderId == null) return fail(NOT_FOUND, 404)

  const detail = await getMyOrderDetail(orderId)
  if (!detail) return fail(NOT_FOUND, 404)

  const { order, items, productSlugs } = detail
  return ok({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt ? order.createdAt.toISOString() : null,
      total: Number(order.total),
      discountTotal: Number(order.discountTotal),
      promoCode: order.promoCode,
      trackingNumber: order.trackingNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      deliveryMethod: order.deliveryMethod,
      deliveryCity: order.deliveryCity,
      deliveryBranch: order.deliveryBranch,
      deliveryAddress: order.deliveryAddress,
    },
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      image: item.image,
      quantity: item.quantity,
      price: Number(item.price),
      total: Number(item.total),
      variantLabel: item.variantLabel,
    })),
    productSlugs,
  })
}
