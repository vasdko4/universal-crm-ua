import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
  // Fallback: the order number remembered when the payment was initiated.
  // Covers gateways whose cabinet-level approvedUrl/declinedUrl override our
  // per-payment returnUrl and arrive without any order reference.
  try {
    const jar = await cookies()
    const fromCookie = jar.get('pf_last_order')?.value
    if (fromCookie) return fromCookie
  } catch {
    /* ignore */
  }
  return undefined
}

function redirectTo(req: Request, orderRef: string | undefined) {
  const base = new URL(req.url).origin
  // Fall back to the home page: /account/orders requires auth and would
  // bounce guest shoppers to the sign-in screen.
  const target = orderRef ? `/checkout/pay/${encodeURIComponent(orderRef)}` : '/'
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
