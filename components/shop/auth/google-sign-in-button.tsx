'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  )
}

/**
 * "Continue with Google" button + "or" divider. Used by the auth dialog and
 * the standalone /account/login and /account/register pages so Google sign-in
 * is available everywhere authentication is offered.
 */
export function GoogleSignInButton({ withDivider = true }: { withDivider?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    try {
      // Google refuses to render its sign-in page inside an iframe (the v0
      // preview runs in one), so we request the OAuth URL without redirecting
      // and navigate manually: new tab inside an iframe, same tab otherwise.
      const inIframe = typeof window !== 'undefined' && window.self !== window.top
      const { data, error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/account',
        errorCallbackURL: '/account/login?error=google',
        disableRedirect: true,
      })
      if (error || !data?.url) {
        setLoading(false)
        return
      }
      if (inIframe) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
        setLoading(false)
      } else {
        window.location.assign(data.url)
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={signInWithGoogle}
        disabled={loading}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
        Продолжить с Google
      </Button>
      {withDivider && (
        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">или</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}
    </>
  )
}
