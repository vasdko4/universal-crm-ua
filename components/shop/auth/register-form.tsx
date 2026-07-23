'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { finalizeCustomerRole, checkPhoneAvailable } from '@/app/actions/shop-auth'
import { normalizeUaPhone } from '@/lib/shop/phone'
import { isAllowedEmailDomain, EMAIL_DOMAIN_ERROR } from '@/lib/shop/email-domains'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterForm() {
  const { dict: t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('+380')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const normPhone = normalizeUaPhone(phone)
    if (!name.trim()) return setError(t.auth.nameRequired)
    if (!normPhone) return setError(t.auth.invalidPhoneFormat)
    if (!isAllowedEmailDomain(email.trim())) return setError(EMAIL_DOMAIN_ERROR)
    if (password.length < 8) return setError(t.auth.passwordTooShort)

    setLoading(true)

    // The phone is a unique customer identifier: verify availability BEFORE
    // creating the account so we never produce duplicates.
    const phoneCheck = await checkPhoneAvailable(normPhone)
    if (!phoneCheck.available) {
      setLoading(false)
      return setError(phoneCheck.error ?? t.auth.phoneAlreadyRegistered)
    }

    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      // additional field
      phone: normPhone,
    } as Parameters<typeof authClient.signUp.email>[0])

    if (error) {
      setLoading(false)
      if (/exist|already|unique/i.test(error.message ?? '')) return setError(t.auth.userAlreadyExists)
      return setError(error.message ?? t.auth.registrationError)
    }

    // Mark as storefront customer and persist phone server-side.
    await finalizeCustomerRole(normPhone)
    // Hard navigation guarantees the fresh session cookie is picked up.
    window.location.assign('/account')
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">{t.auth.nameLabel}</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t.auth.phoneLabel}</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+380 67 123 45 67"
          required
          autoComplete="tel"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t.auth.emailLabel}</Label>
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
        <Label htmlFor="password">{t.auth.passwordLabel}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">{t.auth.minPasswordHint}</p>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading && <Loader2 className="size-4 animate-spin" />}
        {t.auth.registerButton}
      </Button>
    </form>
  )
}
