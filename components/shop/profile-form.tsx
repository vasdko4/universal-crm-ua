'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { updateCustomerProfile, requestEmailChange, confirmEmailChange } from '@/app/actions/shop-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    if (!name.trim()) return setError('Введите имя')
    setLoading(true)
    const res = await updateCustomerProfile({ name: name.trim() })
    setLoading(false)
    if (!res.success) return setError(res.error ?? 'Ошибка сохранения')
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  async function onRequestCode() {
    setEmailError(null)
    setEmailInfo(null)
    if (!newEmail.trim()) return setEmailError('Введите новый email')
    setEmailLoading(true)
    const res = await requestEmailChange(newEmail)
    setEmailLoading(false)
    if (!res.success) return setEmailError(res.error ?? 'Ошибка отправки кода')
    setEmailStep('code')
    setEmailInfo(`Код отправлен на ${newEmail.trim()}. Проверьте почту.`)
  }

  async function onConfirmCode() {
    setEmailError(null)
    setEmailInfo(null)
    if (!code.trim()) return setEmailError('Введите код из письма')
    setEmailLoading(true)
    const res = await confirmEmailChange(code)
    setEmailLoading(false)
    if (!res.success) return setEmailError(res.error ?? 'Неверный код')
    setEmailStep('idle')
    setNewEmail('')
    setCode('')
    setEmailInfo('Email успешно изменён')
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
          <Label htmlFor="name">Имя и фамилия</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input id="phone" type="tel" value={initialPhone || '—'} disabled />
          <p className="text-xs text-muted-foreground">
            Телефон изменить нельзя. Для смены номера обратитесь в поддержку.
          </p>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Сохранить
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-primary">
              <Check className="size-4" /> Сохранено
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Электронная почта</Label>
          <Input id="email" value={email} disabled />
        </div>

        {emailLocked ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Вы вошли через Google — почта привязана к вашему Google-аккаунту, изменить её нельзя.
            </p>
          </div>
        ) : emailStep === 'idle' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-email">Новый email</Label>
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
                  Отправить код
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                На новый адрес придёт письмо с кодом подтверждения.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-code">Код из письма</Label>
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
                  Подтвердить
                </Button>
                <Button type="button" variant="ghost" onClick={onCancelEmailChange}>
                  Отмена
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
