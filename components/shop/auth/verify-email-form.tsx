'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { confirmEmailVerification, sendEmailVerification } from '@/app/actions/shop-auth'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function VerifyEmailForm({ email }: { email: string }) {
  const { dict: t, locale } = useI18n()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(t.auth.codeSent)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (otp.trim().length !== 6) return setError(t.auth.otpMustBe6Digits)
    setLoading(true)
    const res = await confirmEmailVerification(otp.trim())
    setLoading(false)
    if (!res.success) return setError(res.error ?? t.auth.invalidOrExpiredCode)
    window.location.assign(localizedPath('/account', locale))
  }

  async function onResend() {
    setError(null)
    setResending(true)
    const res = await sendEmailVerification()
    setResending(false)
    if (!res.success) return setError(res.error ?? t.auth.couldNotSendCode)
    if (res.alreadyVerified) {
      window.location.assign(localizedPath('/account', locale))
      return
    }
    setInfo(t.auth.codeSent)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {info && (
        <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {info} {email}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="otp">{t.auth.otpLabel}</Label>
        <Input
          id="otp"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="text-center text-lg tracking-[0.5em]"
          required
          autoComplete="one-time-code"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" />}
        {t.auth.verifyEmailButton}
      </Button>
      <button
        type="button"
        onClick={onResend}
        disabled={resending}
        className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary hover:underline disabled:opacity-50"
      >
        {resending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        {t.auth.resendCodeButton}
      </button>
    </form>
  )
}
