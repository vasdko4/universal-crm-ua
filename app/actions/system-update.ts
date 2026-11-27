'use server'

import { assertWritePermission } from '@/lib/session'
import { isRateLimited } from '@/lib/api/rate-limit'
import { stripTrailingSlashes } from '@/lib/text'

/**
 * Triggers a self-update: asks the `updater` sidecar container (see
 * docker-compose.yml + scripts/updater.py) to `docker compose pull && up -d`
 * the `app` service to the `:latest` image. The sidecar is the only thing
 * with access to the Docker socket — this app container never gets it,
 * keeping the blast radius of a compromised app process limited.
 *
 * No-ops with a clear error on deployments that don't run the sidecar
 * (e.g. Vercel, or a Docker install that hasn't opted in yet).
 */
export async function triggerSelfUpdate(): Promise<{ ok: boolean; error?: string }> {
  const me = await assertWritePermission('system_updates')
  // A redeploy per click is the whole point of the button — but an
  // unthrottled admin session could loop it. 5/min per admin.
  if (await isRateLimited('system-update', me.id, 5, 60_000)) {
    return { ok: false, error: 'rate_limited' }
  }

  const url = process.env.UPDATER_URL
  const secret = process.env.UPDATER_SECRET
  if (!url || !secret) {
    return { ok: false, error: 'not_configured' }
  }

  try {
    const res = await fetch(`${stripTrailingSlashes(url)}/update`, {
      method: 'POST',
      headers: { 'X-Updater-Secret': secret },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, error: `updater_http_${res.status}` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'updater_unreachable' }
  }
}
