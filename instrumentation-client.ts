import * as Sentry from '@sentry/nextjs'

// Browser-side errors (client components, hydration issues, etc).
// NEXT_PUBLIC_SENTRY_DSN must be a *public* DSN — it's fine to expose it to
// the browser, that's what it's for. Leave unset to disable.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
