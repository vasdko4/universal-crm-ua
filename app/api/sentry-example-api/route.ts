import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message)
    this.name = 'SentryExampleAPIError'
  }
}

// Wizard verification route. Throws so Sentry captures a server error.
export function GET() {
  throw new SentryExampleAPIError('This error was thrown by the Sentry example API route.')
  return NextResponse.json({ data: 'Testing Sentry Error...' })
}
