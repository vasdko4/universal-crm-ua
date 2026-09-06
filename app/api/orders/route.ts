import { type NextRequest } from 'next/server'
import { listOrders, createOrder } from '@/app/actions/orders'
import { ok, fail, parsePositiveInt, sanitizeSearch, readJson } from '@/lib/api/helpers'
import { getAdminUser } from '@/lib/session'
import { ORDER_STATUSES } from '@/lib/order-status'

const ALLOWED_STATUSES = new Set<string>(['all', ...ORDER_STATUSES.map((s) => s.value)])
const MAX_PER_PAGE = 100
const DEFAULT_PER_PAGE = 20

export async function GET(req: NextRequest) {
  const me = await getAdminUser()
  if (!me) return fail('Не авторизован', 401)

  const sp = req.nextUrl.searchParams

  const pageRaw = sp.get('page')
  let page = 1
  if (pageRaw != null && pageRaw !== '') {
    const parsed = parsePositiveInt(pageRaw)
    if (parsed == null) return fail('Некорректный page', 400)
    page = parsed
  }

  const perPageRaw = sp.get('perPage')
  let perPage = DEFAULT_PER_PAGE
  if (perPageRaw != null && perPageRaw !== '') {
    const parsed = parsePositiveInt(perPageRaw)
    if (parsed == null || parsed > MAX_PER_PAGE) return fail('Некорректный perPage', 400)
    perPage = parsed
  }

  const statusRaw = sp.get('status')
  if (statusRaw != null && statusRaw !== '' && !ALLOWED_STATUSES.has(statusRaw)) {
    return fail(`Некорректный status. Допустимые: ${[...ALLOWED_STATUSES].join(', ')}`, 400)
  }
  const status = !statusRaw || statusRaw === 'all' ? undefined : statusRaw

  const search = sanitizeSearch(sp.get('q') ?? sp.get('search') ?? '')
  const data = await listOrders({
    search: search || undefined,
    status,
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
