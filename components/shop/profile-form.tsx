'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  updateCustomerProfile,
  requestEmailChange,
  confirmEmailChange,
  requestPasswordChange,
  confirmPasswordChange,
} from '@/app/actions/shop-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n/client'
import { fillTemplate } from '@/lib/i18n/dictionaries'
import { cn } from '@/lib/utils'

export function ProfileForm({
  initialName,
  initialPhone,
  email,
  emailLocked = false,
  passwordLocked = false,
}: {
  initialName: string
  initialPhone: string
  email: string
  emailLocked?: boolean
  passwordLocked?: boolean
}) {
  const { dict } = useI18n()
  const t = dict.profile
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailStep, setEmailStep] = useState<'idle' | 'code'>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailInfo, setEmailInfo] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  const [passwordStep, setPasswordStep] = useState<'idle' | 'code'>('idle')
  const [passwordCode, setPasswordCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

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
    setEmailOpen(false)
    setNewEmail('')
    setCode('')
    setEmailInfo(t.emailChanged)
    router.refresh()
  }

  function onCancelEmailChange() {
    setEmailStep('idle')
    setEmailOpen(false)
    setNewEmail('')
    setCode('')
    setEmailError(null)
    setEmailInfo(null)
  }

  async function onRequestPasswordCode() {
    setPasswordError(null)
    setPasswordInfo(null)
    setPasswordLoading(true)
    const res = await requestPasswordChange()
    setPasswordLoading(false)
    if (!res.success) return setPasswordError(res.error ?? t.sendCodeError)
    setPasswordStep('code')
    setPasswordInfo(fillTemplate(t.passwordCodeSentTo, { email }))
  }

  async function onConfirmPassword() {
    setPasswordError(null)
    setPasswordInfo(null)
    if (!passwordCode.trim()) return setPasswordError(t.codeRequired)
    if (newPassword.length < 8) return setPasswordError(t.passwordTooShort)
    if (newPassword !== confirmPassword) return setPasswordError(t.passwordsMismatch)
    setPasswordLoading(true)
    const res = await confirmPasswordChange(passwordCode, newPassword)
    setPasswordLoading(false)
    if (!res.success) return setPasswordError(res.error ?? t.invalidCode)
    setPasswordStep('idle')
    setPasswordCode('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setPasswordInfo(t.passwordChanged)
  }

  function onCancelPasswordChange() {
    setPasswordStep('idle')
    setPasswordCode('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setPasswordError(null)
    setPasswordInfo(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onSubmit}
        className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
        <SectionHead
          icon={<UserRound className="size-5" />}
          title={t.sectionTitle}
          hint={t.sectionDescription}
        />
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <Field id="name" label={t.nameLabel}>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </Field>
          <Field id="phone" label={dict.account.phone} hint={t.phoneImmutableNote}>
            <Input id="phone" type="tel" value={initialPhone || '—'} disabled />
          </Field>
        </div>
        {error && <Banner tone="error">{error}</Banner>}
        <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {dict.account.save}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <Check className="size-4" /> {t.savedLabel}
            </span>
          )}
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <SectionHead
          icon={<Mail className="size-5" />}
          title={t.emailLabel}
          hint={t.newEmailHint}
          badge={
            emailLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <ShieldCheck className="size-3" />
                {t.googleAccountBadge}
              </span>
            ) : undefined
          }
        />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <Field id="email" label={t.emailLabel}>
            <Input id="email" value={email} disabled className="font-medium" />
          </Field>

          {emailLocked ? (
            <LockedNote>{t.googleLockedMessage}</LockedNote>
          ) : !emailOpen && emailStep === 'idle' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEmailOpen(true)
                setEmailInfo(null)
                setEmailError(null)
              }}
              className="w-full sm:w-fit"
            >
              <Mail className="size-4" />
              {t.changeEmailButton}
            </Button>
          ) : emailStep === 'idle' ? (
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <StepLabel current={1} total={2} />
              <Field id="new-email" label={t.newEmailLabel} hint={t.newEmailHint}>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="new@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="sm:flex-1"
                    autoComplete="email"
                  />
                  <Button type="button" onClick={onRequestCode} disabled={emailLoading} className="sm:w-auto">
                    {emailLoading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                    {dict.auth.sendCodeButton}
                  </Button>
                </div>
              </Field>
              <Button type="button" variant="ghost" size="sm" onClick={onCancelEmailChange} className="mt-3">
                {dict.account.cancel}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <StepLabel current={2} total={2} />
              <Field id="email-code" label={t.codeFromEmail}>
                <Input
                  id="email-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="h-12 max-w-[12rem] text-center font-mono text-xl tracking-[0.35em]"
                />
              </Field>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={onConfirmCode} disabled={emailLoading || code.length < 6}>
                  {emailLoading && <Loader2 className="size-4 animate-spin" />}
                  {t.confirmButton}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancelEmailChange}>
                  {dict.account.cancel}
                </Button>
              </div>
            </div>
          )}

          {emailInfo && <Banner tone="ok">{emailInfo}</Banner>}
          {emailError && <Banner tone="error">{emailError}</Banner>}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <SectionHead
          icon={<Lock className="size-5" />}
          title={t.passwordSectionTitle}
          hint={t.passwordSectionHint}
        />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          {passwordLocked ? (
            <LockedNote>
              {emailLocked ? t.googlePasswordLockedMessage : t.passwordUnavailableMessage}
            </LockedNote>
          ) : passwordStep === 'idle' ? (
            <Button
              type="button"
              variant="outline"
              onClick={onRequestPasswordCode}
              disabled={passwordLoading}
              className="w-full sm:w-fit"
            >
              {passwordLoading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {t.sendPasswordCodeButton}
            </Button>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <StepLabel current={2} total={2} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="password-code" label={t.codeFromEmail}>
                  <Input
                    id="password-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={passwordCode}
                    onChange={(e) => setPasswordCode(e.target.value.replace(/\D/g, ''))}
                    className="h-12 max-w-[12rem] text-center font-mono text-xl tracking-[0.35em]"
                  />
                </Field>
                <div className="hidden sm:block" />
                <Field id="new-password" label={t.newPasswordLabel} hint={t.passwordTooShort}>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide' : 'Show'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>
                <Field id="confirm-password" label={t.confirmNewPasswordLabel}>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                  />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={onConfirmPassword}
                  disabled={passwordLoading || passwordCode.length < 6}
                >
                  {passwordLoading && <Loader2 className="size-4 animate-spin" />}
                  {t.confirmPasswordButton}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancelPasswordChange}>
                  {dict.account.cancel}
                </Button>
              </div>
            </div>
          )}

          {passwordInfo && <Banner tone="ok">{passwordInfo}</Banner>}
          {passwordError && <Banner tone="error">{passwordError}</Banner>}
        </div>
      </section>
    </div>
  )
}

function SectionHead({
  icon,
  title,
  hint,
  badge,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {badge}
        </div>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StepLabel({ current, total }: { current: number; total: number }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-primary">
      {current}/{total}
    </p>
  )
}

function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 p-3.5">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  )
}

function Banner({ tone, children }: { tone: 'ok' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm',
        tone === 'ok'
          ? 'bg-primary/10 text-primary'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {tone === 'ok' ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{children}</span>
    </p>
  )
}
