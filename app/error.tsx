'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app-error]', error)
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">Ошибка</p>
      <h1 className="text-balance text-2xl font-semibold text-foreground">
        Что-то пошло не так
      </h1>
      <p className="max-w-md text-pretty text-sm text-muted-foreground">
        Произошла непредвиденная ошибка. Попробуйте обновить страницу — если проблема
        повторяется, вернитесь позже.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Попробовать снова</Button>
        <Button variant="outline" asChild>
          <a href="/">На главную</a>
        </Button>
      </div>
    </main>
  )
}
