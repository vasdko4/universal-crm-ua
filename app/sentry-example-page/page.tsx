'use client'

import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'

class SentryExampleFrontendError extends Error {
  constructor(message: string | undefined) {
    super(message)
    this.name = 'SentryExampleFrontendError'
  }
}

export default function SentryExamplePage() {
  const [hasSentError, setHasSentError] = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [busy, setBusy] = useState(false)
  const dsnSet = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

  useEffect(() => {
    let cancelled = false
    async function checkConnectivity() {
      try {
        const result = await Sentry.diagnoseSdkConnectivity()
        if (!cancelled) setIsConnected(result !== 'sentry-unreachable')
      } catch {
        if (!cancelled) setIsConnected(false)
      }
    }
    void checkConnectivity()
    return () => {
      cancelled = true
    }
  }, [])

  async function throwSampleError() {
    setBusy(true)
    await Sentry.startSpan(
      {
        name: 'Example Frontend/Backend Span',
        op: 'test',
      },
      async () => {
        const res = await fetch('/api/sentry-example-api')
        if (!res.ok) setHasSentError(true)
      },
    )
    throw new SentryExampleFrontendError('This error was thrown from the Sentry example page.')
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center gap-4 px-4 py-16">
      <p className="text-sm font-medium text-muted-foreground">Sentry</p>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">sentry-example-page</h1>
      <p className="text-sm text-muted-foreground">
        Кнопка кидает ошибку на сервере (`/api/sentry-example-api`) и в браузере. Если DSN задан,
        через несколько секунд она появится в Sentry Issues.
      </p>

      {!dsnSet && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          `NEXT_PUBLIC_SENTRY_DSN` пустой — SDK ничего не отправит. Добавь DSN в Vercel и сделай
          redeploy.
        </p>
      )}
      {dsnSet && !isConnected && (
        <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
          Браузер не достучался до Sentry (блокировщик / сеть).
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void throwSampleError()
        }}
        className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        Throw Sample Error
      </button>

      {hasSentError ? (
        <p className="text-sm text-foreground">
          Ошибка ушла. Открой{' '}
          <a
            className="underline"
            href="https://no-da1.sentry.io/issues/?project=javascript-nextjs"
            target="_blank"
            rel="noreferrer"
          >
            Sentry Issues
          </a>
          .
        </p>
      ) : null}
    </main>
  )
}
