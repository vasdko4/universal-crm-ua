import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { deliveryMethods, orders } from '@/lib/db/schema'
import { getAdminUserWithPermission } from '@/lib/session'
import { novaPoshtaPrintUrl } from '@/lib/delivery/ttn'
import { parsePositiveInt } from '@/lib/api/helpers'

/**
 * Proxies Nova Poshta printDocument PDF so the API key never lands in the
 * browser URL / history (the NP print URL embeds apiKey as a path segment).
 */
export async function GET(req: NextRequest) {
  const me = await getAdminUserWithPermission('orders')
  if (!me) return new NextResponse('Unauthorized', { status: 401 })

  const orderId = parsePositiveInt(req.nextUrl.searchParams.get('orderId') ?? '')
  if (orderId == null) return new NextResponse('Bad orderId', { status: 400 })

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  const ttn = (order?.trackingNumber || '').trim()
  if (!ttn) return new NextResponse('No TTN', { status: 404 })

  const [row] = await db
    .select()
    .from(deliveryMethods)
    .where(eq(deliveryMethods.code, 'nova_poshta'))
    .limit(1)
  const cfg = ((row?.config as Record<string, string>) ?? {}) as Record<string, string>
  const apiKey = (cfg.apiKey || process.env.NOVA_POSHTA_API_KEY || '').trim()
  if (!apiKey) return new NextResponse('No API key', { status: 400 })

  const upstream = await fetch(novaPoshtaPrintUrl(apiKey, ttn), {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })
  if (!upstream.ok) return new NextResponse('Upstream error', { status: 502 })

  const contentType = upstream.headers.get('content-type') ?? 'application/pdf'
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="ttn-${ttn}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
