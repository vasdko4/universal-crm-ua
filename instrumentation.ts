// Server/edge Sentry init. No-ops safely if SENTRY_DSN is not set (e.g. local
// dev, or before you've created a Sentry project) — nothing is sent, no
// crash. See README.local.md "Мониторинг ошибок (Sentry)" for setup.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export async function onRequestError(...args: Parameters<typeof import('@sentry/nextjs').captureRequestError>) {
  if (!process.env.SENTRY_DSN) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
