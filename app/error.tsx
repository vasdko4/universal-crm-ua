'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function isRuPath(): boolean {
  if (typeof window === 'undefined') return false
  const p = window.location.pathname
  return p === '/ru' || p.startsWith('/ru/')
}

const COPY = {
  uk: {
    label: 'Помилка',
    heading: 'Щось пішло не так',
    description:
      'Сталася непередбачена помилка. Спробуйте оновити сторінку — якщо проблема повториться, поверніться пізніше.',
    retry: 'Спробувати знову',
    home: 'На головну',
    homeHref: '/',
  },
  ru: {
    label: 'Ошибка',
    heading: 'Что-то пошло не так',
    description:
      'Произошла непредвиденная ошибка. Попробуйте обновить страницу — если проблема повторяется, вернитесь позже.',
    retry: 'Попробовать снова',
    home: 'На главную',
    homeHref: '/ru',
  },
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = isRuPath() ? COPY.ru : COPY.uk

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
          <Link href={t.homeHref}>{t.home}</Link>
        </Button>
      </div>
    </main>
  )
}
