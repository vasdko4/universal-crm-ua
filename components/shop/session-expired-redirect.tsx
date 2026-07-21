'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Client-side redirect used as a safety net when a session cookie is present
// but the session is invalid/expired. We intentionally avoid a server-side
// redirect() here: calling redirect() while a Server Component is still
// rendering aborts it mid-render, which React's dev performance profiler
// mis-times and reports as a "negative time stamp" crash.
export function SessionExpiredRedirect({ to = '/account/login' }: { to?: string }) {
  const router = useRouter()

  useEffect(() => {
    router.replace(to)
  }, [router, to])

  return null
}
