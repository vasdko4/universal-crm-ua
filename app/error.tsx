'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { localizedPath, type Locale } from '@/lib/i18n/config'

function localeFromPath(): Locale {
  if (typeof window === 'undefined') return 'uk'
  const p = window.location.pathname
  return p === '/ru' || p.startsWith('/ru/') ? 'ru' : 'uk'
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = localeFromPath()
  const t = getDictionary(locale).errorPage

  useEffect(() => {
    console.error('[app-error]', error)
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">{t.label}</p>
      <h1 className="text-balance text-2xl font-semibold text-foreground">{t.heading}</h1>
      <p className="max-w-md text-pretty text-sm text-muted-foreground">{t.description}</p>
      <div className="flex gap-3">
        <Button onClick={reset}>{t.retry}</Button>
        <Button variant="outline" asChild>
          <Link href={localizedPath('/', locale)}>{t.home}</Link>
        </Button>
      </div>
    </main>
  )
}
