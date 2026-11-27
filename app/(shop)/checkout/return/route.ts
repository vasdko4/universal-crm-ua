import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getLocale } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'
import { getOrderNumberByGuestToken } from '@/app/actions/shop'

export const dynamic = 'force-dynamic'

// WayForPay "returnUrl" (approvedUrl / declinedUrl). The gateway sends the
// customer's browser back here, by default via POST with the transaction
// fields. We resolve the order reference and forward the shopper to the order
// payment/status page, which reads the authoritative status from the DB
// (already updated by the Service URL webhook).
async function resolveOrderRef(req: Request): Promise<string | undefined> {
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get('orderReference') || url.searchParams.get('order')
  if (fromQuery) return fromQuery
  try {
    const raw = await req.text()
    if (raw) {
      try {
        const json = JSON.parse(raw)
        if (json?.orderReference) return String(json.orderReference)
      } catch {
        const params = new URLSearchParams(raw)
        const direct = params.get('orderReference')
        if (direct) return direct
        const first = [...params.keys()][0]
        if (first) {
          try {
            const json = JSON.parse(first)
            if (json?.orderReference) return String(json.orderReference)
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  // Fallback: the pf_last_order cookie now holds a guest access token,
  // not an order number (3.4.107, fix 5) — resolve it to the order number
  // via the stored hash. Covers gateways whose cabinet-level
  // approvedUrl/declinedUrl override our per-payment returnUrl and arrive
  // without any order reference. A legacy plain-number cookie resolves to
  // nothing and falls through to the home page.
  try {
    const jar = await cookies()
    const fromCookie = jar.get('pf_last_order')?.value
    if (fromCookie) {
      const orderNumber = await getOrderNumberByGuestToken(fromCookie)
      if (orderNumber) return orderNumber
    }
  } catch {
    /* ignore */
  }
  return undefined
}

async function redirectTo(req: Request, orderRef: string | undefined) {
  const base = new URL(req.url).origin
  const locale = await getLocale()
  // Fall back to the home page: /account/orders requires auth and would
  // bounce guest shoppers to the sign-in screen. Keep /ru when the shopper
  // returned from the gateway on a Russian URL.
  const target = orderRef
    ? localizedPath(`/checkout/pay/${encodeURIComponent(orderRef)}`, locale)
    : localizedPath('/', locale)
  return NextResponse.redirect(new URL(target, base), 303)
}

export async function POST(req: Request) {
  const orderRef = await resolveOrderRef(req)
  return redirectTo(req, orderRef)
}

export async function GET(req: Request) {
  const orderRef = await resolveOrderRef(req)
  return redirectTo(req, orderRef)
}
