import * as Sentry from '@sentry/nextjs'

// Set SENTRY_DSN in your environment to enable. Without it, init() is a
// harmless no-op (SDK just doesn't send anything) — safe to leave this file
// active even before you've created a Sentry project.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Keep this low on a small VPS / low-traffic store — 100% would work fine
  // for a store this size, but 20% avoids adding unnecessary CPU/network
  // overhead to every request while still catching all *errors* (errors are
  // always captured regardless of this sample rate; this only controls
  // performance-tracing spans).
  tracesSampleRate: 0.2,
  // Don't spam the free tier with noisy expected 4xx-type app errors.
  ignoreErrors: ['NEXT_NOT_FOUND', 'NEXT_REDIRECT'],
})
