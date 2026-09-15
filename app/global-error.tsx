'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  const ru =
    typeof window !== 'undefined' &&
    (window.location.pathname === '/ru' || window.location.pathname.startsWith('/ru/'))

  return (
    <html lang={ru ? 'ru' : 'uk'}>
      <body>
        <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>{ru ? 'Что-то пошло не так. Обновите страницу.' : 'Щось пішло не так. Оновіть сторінку.'}</p>
        </main>
      </body>
    </html>
  )
}
