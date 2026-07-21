'use client'

import { useState } from 'react'
import { Loader2, Phone } from 'lucide-react'
import { saveCustomerPhone } from '@/app/actions/shop-auth'
import { normalizeUaPhone } from '@/lib/shop/phone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Blocking dialog shown to customers without a phone number (e.g. after a
// Google sign-up). It cannot be dismissed until a valid phone is saved.
export function PhoneRequiredDialog() {
  const [phone, setPhone] = useState('+380')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const norm = normalizeUaPhone(phone)
    if (!norm) return setError('Введите корректный номер телефона (например, +380 67 123 45 67)')
    setLoading(true)
    const res = await saveCustomerPhone(norm)
    setLoading(false)
    if (!res.success) return setError(res.error ?? 'Не удалось сохранить номер')
    setDone(true)
    // Refresh so server components pick up the saved phone.
    window.location.reload()
  }

  return (
    <Dialog open={!done}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Phone className="size-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Укажите номер телефона</DialogTitle>
          <DialogDescription className="text-center">
            Для завершения регистрации укажите ваш номер телефона. Он нужен для оформления и
            подтверждения заказов.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="required-phone">Номер телефона</Label>
            <Input
              id="required-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+380 67 123 45 67"
              required
              autoComplete="tel"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={loading} className="w-full">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Сохранить
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
