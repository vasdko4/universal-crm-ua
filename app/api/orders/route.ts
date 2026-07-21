import { type NextRequest } from 'next/server'
import { listOrders, createOrder } from '@/app/actions/orders'
import { ok, fail } from '@/lib/api/helpers'
import { getAdminUser } from '@/lib/session'

export async function GET(req: NextRequest) {
  const me = await getAdminUser()
  if (!me) return fail('Не авторизован', 401)
  const sp = req.nextUrl.searchParams
  const data = await listOrders({
    search: sp.get('q') ?? undefined,
    status: sp.get('status') ?? undefined,
    page: sp.get('page') ? Number.parseInt(sp.get('page')!, 10) : 1,
    perPage: sp.get('perPage') ? Number.parseInt(sp.get('perPage')!, 10) : 20,
  })
  return ok(data)
}

export async function POST(req: NextRequest) {
  const me = await getAdminUser()
  if (!me) return fail('Не авторизован', 401)
  try {
    const body = await req.json()
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return fail('Заказ должен содержать хотя бы один товар', 400)
    }
    const res = await createOrder(body)
    return ok(res)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
