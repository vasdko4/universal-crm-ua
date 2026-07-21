import * as Sentry from '@sentry/nextjs'

// Covers the middleware / edge runtime. Same DSN as sentry.server.config.ts.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
})
