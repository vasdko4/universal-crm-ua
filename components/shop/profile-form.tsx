'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { updateCustomerProfile, requestEmailChange, confirmEmailChange } from '@/app/actions/shop-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n/client'
import { fillTemplate } from '@/lib/i18n/dictionaries'

export function ProfileForm({
  initialName,
  initialPhone,
  email,
  emailLocked = false,
}: {
  initialName: string
  initialPhone: string
  email: string
  /** True for Google-authenticated accounts: email cannot be changed. */
  emailLocked?: boolean
}) {
  const { dict } = useI18n()
  const t = dict.profile
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  // Email change flow: idle -> code (code sent, waiting for input)
  const [emailStep, setEmailStep] = useState<'idle' | 'code'>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailInfo, setEmailInfo] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    if (!name.trim()) return setError(t.nameRequired)
    setLoading(true)
    const res = await updateCustomerProfile({ name: name.trim() })
    setLoading(false)
    if (!res.success) return setError(res.error ?? t.saveError)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  async function onRequestCode() {
    setEmailError(null)
    setEmailInfo(null)
    if (!newEmail.trim()) return setEmailError(t.newEmailRequired)
    setEmailLoading(true)
    const res = await requestEmailChange(newEmail)
    setEmailLoading(false)
    if (!res.success) return setEmailError(res.error ?? t.sendCodeError)
    setEmailStep('code')
    setEmailInfo(fillTemplate(t.codeSentTo, { email: newEmail.trim() }))
  }

  async function onConfirmCode() {
    setEmailError(null)
    setEmailInfo(null)
    if (!code.trim()) return setEmailError(t.codeRequired)
    setEmailLoading(true)
    const res = await confirmEmailChange(code)
    setEmailLoading(false)
    if (!res.success) return setEmailError(res.error ?? t.invalidCode)
    setEmailStep('idle')
    setNewEmail('')
    setCode('')
    setEmailInfo(t.emailChanged)
    router.refresh()
  }

  function onCancelEmailChange() {
    setEmailStep('idle')
    setNewEmail('')
    setCode('')
    setEmailError(null)
    setEmailInfo(null)
  }

  return (
    <div className="flex max-w-md flex-col gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t.nameLabel}</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">{dict.account.phone}</Label>
          <Input id="phone" type="tel" value={initialPhone || '—'} disabled />
          <p className="text-xs text-muted-foreground">{t.phoneImmutableNote}</p>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {dict.account.save}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-primary">
              <Check className="size-4" /> {t.savedLabel}
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t.emailLabel}</Label>
          <Input id="email" value={email} disabled />
        </div>

        {emailLocked ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs leading-relaxed text-muted-foreground">{t.googleLockedMessage}</p>
          </div>
        ) : emailStep === 'idle' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-email">{t.newEmailLabel}</Label>
              <div className="flex gap-2">
                <Input
                  id="new-email"
                  type="email"
                  placeholder="new@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={onRequestCode} disabled={emailLoading}>
                  {emailLoading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                  {dict.auth.sendCodeButton}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t.newEmailHint}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-code">{t.codeFromEmail}</Label>
              <div className="flex gap-2">
                <Input
                  id="email-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="max-w-32 tracking-widest"
                />
                <Button type="button" onClick={onConfirmCode} disabled={emailLoading}>
                  {emailLoading && <Loader2 className="size-4 animate-spin" />}
                  {t.confirmButton}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancelEmailChange}>
                  {dict.account.cancel}
                </Button>
              </div>
            </div>
          </div>
        )}

        {emailInfo && <p className="text-sm text-primary">{emailInfo}</p>}
        {emailError && (
          <p className="text-sm text-destructive" role="alert">
            {emailError}
          </p>
        )}
      </div>
    </div>
  )
}
