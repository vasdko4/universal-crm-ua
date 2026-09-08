'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { beginStaffTwoFactor, confirmStaffTwoFactor, disableStaffTwoFactor } from '@/app/actions/staff-2fa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function StaffTwoFactorCard({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition()
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauth, setOtpauth] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [on, setOn] = useState(enabled)

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
      toast.success('2FA увімкнено')
      setOn(true)
      setSecret(null)
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
      toast.success('2FA вимкнено')
      setOn(false)
      setCode('')
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">2FA (TOTP)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {on ? 'Увімкнено для цього акаунта.' : 'Додатковий код з Authenticator при вході в адмінку.'}
      </p>
      {secret && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="break-all font-mono">{secret}</p>
          {otpauth && (
            <a className="text-primary underline" href={otpauth}>
              Відкрити в додатку
            </a>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {!on && !secret && (
          <Button size="sm" onClick={startEnroll} disabled={pending}>
            Увімкнути
          </Button>
        )}
        {(secret || on) && (
          <>
            <Input
              className="w-28"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
            />
            {secret ? (
              <Button size="sm" onClick={confirm} disabled={pending}>
                Підтвердити
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={disable} disabled={pending}>
                Вимкнути
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
