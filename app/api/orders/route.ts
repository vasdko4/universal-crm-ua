import { type NextRequest } from 'next/server'
import { listOrders, createOrder } from '@/app/actions/orders'
import { ok, fail, parseListParams, readJson } from '@/lib/api/helpers'
import { getAdminUser } from '@/lib/session'

export async function GET(req: NextRequest) {
  const me = await getAdminUser()
  if (!me) return fail('Не авторизован', 401)
  const { page, search, status, searchParams } = parseListParams(req.url)
  const perPageRaw = searchParams.get('perPage')
  const perPage = Math.min(100, Math.max(1, Number.parseInt(perPageRaw ?? '20', 10) || 20))
  const data = await listOrders({
    search: search || undefined,
    status: status === 'all' ? undefined : status,
    page,
    perPage,
  })
  return ok(data)
}

export async function POST(req: NextRequest) {
  const me = await getAdminUser()
  if (!me) return fail('Не авторизован', 401)
  const body = await readJson<{ items?: unknown[] }>(req)
  if (!body) return fail('Некорректный JSON', 400)
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return fail('Заказ должен содержать хотя бы один товар', 400)
  }
  try {
    const res = await createOrder(body as Parameters<typeof createOrder>[0])
    return ok(res)
  } catch {
    return fail('Не удалось создать заказ', 500)
  }
}
