import { ok, fail, sanitizeSearch } from '@/lib/api/helpers'
import { isRateLimited, clientIp } from '@/lib/api/rate-limit'
import { searchWarehouses } from '@/app/actions/nova-poshta'

// Nova Poshta refs are UUIDs (demo refs are `demo-<type>-<city>-<n>`).
// Strict charset so no free-form string is ever passed through to the NP API.
const CITY_REF_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/

/**
 * GET /api/v1/delivery/nova-poshta/warehouses?cityRef=&q= — branch list for
 * a city, for the app's checkout. Reuses the checkout's own server action
 * (app/actions/nova-poshta.ts searchWarehouses): same NP call
 * (AddressGeneral/getWarehouses), same list shape [{ref, name, number}].
 * Pass the city's deliveryCityRef (or ref) as cityRef — exactly what the
 * web checkout does. The NP key stays server-side inside the action.
 */
export async function GET(request: Request) {
  if (await isRateLimited('v1-np-warehouses', clientIp(request), 30)) {
    return fail('rate_limited', 429)
  }
  const { searchParams } = new URL(request.url)
  const cityRef = (searchParams.get('cityRef') ?? '').trim()
  if (!CITY_REF_RE.test(cityRef)) {
    return fail('Невірний cityRef', 400)
  }
  const q = sanitizeSearch(searchParams.get('q') ?? '').trim().slice(0, 50)
  const items = await searchWarehouses(cityRef, q)
  return ok(items)
}
