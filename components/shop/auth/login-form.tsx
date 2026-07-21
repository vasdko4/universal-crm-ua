'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { useAuthDialog } from '@/components/shop/auth/auth-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const searchParams = useSearchParams()
  const authDialog = useAuthDialog()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await authClient.signIn.email({ email: email.trim().toLowerCase(), password })
    setLoading(false)
    if (error) {
      // 429 = сработала защита от перебора пароля (5 попыток / 2 минуты).
      setError(
        error.status === 429
          ? 'Слишком много попыток входа. Подождите 2 минуты и попробуйте снова.'
          : 'Неверная почта или пароль',
      )
      return
    }
    // Honor ?redirect= but only allow same-site paths to prevent open redirects.
    const target = searchParams.get('redirect')
    const safeTarget = target && target.startsWith('/') && !target.startsWith('//') ? target : '/account'
    // Use a hard navigation instead of the client router: it guarantees the
    // fresh session cookie is sent with the request and avoids stale router
    // cache showing the logged-out UI after sign-in.
    window.location.assign(safeTarget)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Пароль</Label>
          <Link
            href="/account/forgot-password"
            onClick={() => authDialog?.closeDialog()}
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            Забыли пароль?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" />}
        Войти
      </Button>
    </form>
  )
}
