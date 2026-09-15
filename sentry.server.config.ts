import * as Sentry from '@sentry/nextjs'

const DSN =
  process.env.SENTRY_DSN ||
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://f1d155ef7395e5ea3ca9369daef33331@o4512088162435072.ingest.de.sentry.io/4512088164663376'

Sentry.init({
  dsn: DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
  sendDefaultPii: false,
  ignoreErrors: ['NEXT_NOT_FOUND', 'NEXT_REDIRECT'],
})
