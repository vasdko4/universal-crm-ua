'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ForgotPasswordForm() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await authClient.forgetPassword.emailOtp({ email: email.trim().toLowerCase() })
    setLoading(false)
    if (error) {
      setError(error.message ?? 'Не удалось отправить код')
      return
    }
    setInfo('Код отправлен на почту. Проверьте входящие (и папку «Спам»).')
    setStep('reset')
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (otp.trim().length !== 6) return setError('Код состоит из 6 цифр')
    if (password.length < 8) return setError('Пароль должен быть не менее 8 символов')
    setLoading(true)
    const { error } = await authClient.emailOtp.resetPassword({
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
      password,
    })
    setLoading(false)
    if (error) {
      setError(error.message ?? 'Неверный или просроченный код')
      return
    }
    router.push('/account/login')
    router.refresh()
  }

  if (step === 'email') {
    return (
      <form onSubmit={requestCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Электронная почта</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} size="lg" className="w-full">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Отправить код
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={resetPassword} className="flex flex-col gap-4">
      {info && (
        <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-sm text-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{info}</span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="otp">Код из письма</Label>
        <Input
          id="otp"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="text-center text-lg tracking-[0.5em]"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Новый пароль</Label>
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" />}
        Сбросить пароль
      </Button>
      <button
        type="button"
        onClick={() => setStep('email')}
        className="text-sm text-muted-foreground hover:text-primary hover:underline"
      >
        Отправить код повторно
      </button>
    </form>
  )
}
