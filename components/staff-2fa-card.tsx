'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { beginStaffTwoFactor, confirmStaffTwoFactor, disableStaffTwoFactor } from '@/app/actions/staff-2fa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAdminI18n } from '@/lib/i18n/admin/context'

function qrImageUrl(otpauth: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&ecc=M&data=${encodeURIComponent(otpauth)}`
}

export function StaffTwoFactorCard({ enabled }: { enabled: boolean }) {
  const { dict } = useAdminI18n()
  const t = dict.twoFactor
  const [pending, start] = useTransition()
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauth, setOtpauth] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [on, setOn] = useState(enabled)

  useEffect(() => {
    if (!otpauth) {
      setQr(null)
      return
    }
    let cancelled = false
    setQr(qrImageUrl(otpauth))
    import('qrcode')
      .then((mod) => mod.toDataURL(otpauth, { width: 220, margin: 1, color: { dark: '#111111', light: '#ffffff' } }))
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {
        // Keep the hosted QR fallback.
      })
    return () => {
      cancelled = true
    }
  }, [otpauth])

  function startEnroll() {
    start(async () => {
      const res = await beginStaffTwoFactor()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setSecret(res.secret)
      setOtpauth(res.otpauth)
    })
  }

  function confirm() {
    start(async () => {
      const res = await confirmStaffTwoFactor(code)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(t.enabledToast)
      setOn(true)
      setSecret(null)
      setOtpauth(null)
      setQr(null)
      setCode('')
    })
  }

  function disable() {
    start(async () => {
      const res = await disableStaffTwoFactor(code)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(t.disabledToast)
      setOn(false)
      setCode('')
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">{t.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{on ? t.enabledHint : t.disabledHint}</p>
      {secret && otpauth && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex size-[180px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-2">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="2FA QR" width={180} height={180} className="size-full object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">QR…</span>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-xs text-muted-foreground">{t.scanHint}</p>
            <p className="break-all font-mono text-xs text-foreground">{secret}</p>
            <a className="text-xs text-primary underline" href={otpauth}>
              {t.openInApp}
            </a>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {!on && !secret && (
          <Button size="sm" onClick={startEnroll} disabled={pending}>
            {t.enable}
          </Button>
        )}
        {(secret || on) && (
          <>
            <Input
              className="w-28"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
            {secret ? (
              <Button size="sm" onClick={confirm} disabled={pending || code.length !== 6}>
                {t.confirm}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={disable} disabled={pending || code.length !== 6}>
                {t.disable}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
