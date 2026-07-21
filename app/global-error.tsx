'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Catches errors thrown by the root layout itself (rare, but app/error.tsx
// can't handle those since it lives inside the layout). Must render its own
// <html>/<body> since it replaces the whole root layout.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Что-то пошло не так. Обновите страницу.</p>
        </main>
      </body>
    </html>
  )
}
