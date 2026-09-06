'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { bootstrapAdmin } from '@/app/actions/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Store, Loader2, ShieldCheck } from 'lucide-react'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'

export function SignInForm({
  needsBootstrap,
  storeName,
  copy,
}: {
  needsBootstrap: boolean
  storeName: string
  copy: AdminDictionary['signIn']
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (needsBootstrap) {
      const res = await bootstrapAdmin({ name, email, password })
      if (!res.success) {
        setError(res.error ?? copy.error)
        setLoading(false)
        return
      }
      const { error } = await authClient.signIn.email({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message ?? copy.signInError)
        return
      }
      router.push('/admin')
      router.refresh()
      return
    }

    const { error } = await authClient.signIn.email({ email, password })
    setLoading(false)
    if (error) {
      setError(error.status === 429 ? copy.tooMany : copy.invalid)
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            {needsBootstrap ? <ShieldCheck className="size-6" /> : <Store className="size-6" />}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground text-balance">
            {needsBootstrap ? copy.bootstrapTitle : storeName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {needsBootstrap ? copy.bootstrapSubtitle : copy.subtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {needsBootstrap && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{copy.bootstrapName}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">{copy.password}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={needsBootstrap ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {needsBootstrap ? copy.bootstrapSubmit : copy.submit}
          </Button>
        </form>
      </Card>
    </main>
  )
}
