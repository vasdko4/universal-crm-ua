import { ok, fail, sanitizeSearch } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'
import { searchCities } from '@/app/actions/nova-poshta'

/**
 * GET /api/v1/delivery/nova-poshta/cities?q= — city search for the app's
 * checkout. Reuses the checkout's own server action
 * (app/actions/nova-poshta.ts searchCities): same Nova Poshta call
 * (Address/searchSettlements), same list shape
 * [{ref, name, area, deliveryCityRef}] — the app passes deliveryCityRef
 * (or ref) to the warehouses endpoint, exactly like the web checkout does.
 * The NP key stays server-side inside the action; it is never in the
 * response. The action is fail-soft: an NP error (or its own 30/min
 * limiter) yields [] instead of an error, matching the web checkout.
 */
export async function GET(request: Request) {
  if (await isRateLimited('v1-np-cities', clientIp(request), 30)) {
    return fail('rate_limited', 429)
  }
  const { searchParams } = new URL(request.url)
  const q = sanitizeSearch(searchParams.get('q') ?? '').trim().slice(0, 100)
  if (q.length < 2) {
    // Same as /api/search: a too-short query is an empty result, not an error.
    return ok([])
  }
  const cities = await searchCities(q)
  return ok(cities)
}
