'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateDeliveryMethod } from '@/app/actions/settings'
import type { DeliveryMethod } from '@/lib/db/schema'
import { NovaPoshtaSearch } from './nova-poshta-search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, Truck, PackageCheck, Lock } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

function NovaPoshtaCard({ method }: { method: DeliveryMethod }) {
  const router = useRouter()
  const { dict: t } = useAdminI18n()
  const [isPending, startTransition] = useTransition()
  const initialConfig = (method.config ?? {}) as Record<string, string>
  const [apiKey, setApiKey] = useState(initialConfig.apiKey ?? '')

  function handleSave() {
    startTransition(async () => {
      const result = await updateDeliveryMethod('nova_poshta', {
        isActive: true,
        config: { apiKey },
      })
      if (result.ok) {
        toast.success(result.message)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Truck className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{method.name}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.delivery.npDesc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-success/15 text-success hover:bg-success/25">{t.delivery.badgeActive}</Badge>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Lock className="size-3" /> {t.delivery.badgeRequired}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="np-api-key">{t.delivery.npApiKeyLabel}</Label>
          <Input
            id="np-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            placeholder={t.delivery.npApiKeyPlaceholder}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {apiKey.trim() ? t.delivery.npApiKeyHintReal : t.delivery.npApiKeyHintDemo}
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t.common.save}
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <PackageCheck className="size-4 text-primary" />
            {t.delivery.npCheckTitle}
          </div>
          <NovaPoshtaSearch />
        </div>
      </CardContent>
    </Card>
  )
}

function UkrPoshtaCard({ method }: { method: DeliveryMethod }) {
  const router = useRouter()
  const { dict: t } = useAdminI18n()
  const [isPending, startTransition] = useTransition()
  const [isActive, setIsActive] = useState(method.isActive ?? false)

  function handleToggle(next: boolean) {
    setIsActive(next)
    startTransition(async () => {
      const result = await updateDeliveryMethod('ukrposhta', { isActive: next, config: {} })
      if (result.ok) {
        toast.success(next ? t.delivery.toastUkrEnabled : t.delivery.toastUkrDisabled)
        router.refresh()
      } else {
        toast.error(result.message)
        setIsActive(!next)
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-warning/15 text-warning">
            <Truck className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{method.name}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.delivery.ukrDesc}</p>
          </div>
        </div>
        {isActive ? (
          <Badge className="bg-success/15 text-success hover:bg-success/25">{t.delivery.badgeActive}</Badge>
        ) : (
          <Badge variant="secondary">{t.delivery.badgeDisabled}</Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="ukr-active">{t.delivery.ukrToggleLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.delivery.ukrToggleDesc}</p>
          </div>
          <div className="flex items-center gap-2">
            {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <Switch
              id="ukr-active"
              checked={isActive}
              disabled={isPending}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DeliveryManager({ methods }: { methods: DeliveryMethod[] }) {
  const { dict: t } = useAdminI18n()
  const novaPoshta = methods.find((m) => m.code === 'nova_poshta')
  const ukrPoshta = methods.find((m) => m.code === 'ukrposhta')

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.delivery.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.delivery.pageSubtitle}</p>
      </header>
      <div className="grid gap-4 xl:grid-cols-2">
        {novaPoshta && <NovaPoshtaCard method={novaPoshta} />}
        {ukrPoshta && <UkrPoshtaCard method={ukrPoshta} />}
      </div>
    </div>
  )
}
