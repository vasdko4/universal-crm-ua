'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateGateway } from '@/app/actions/payments'
import type { PaymentGateway } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, CreditCard, Copy, Check, Link2 } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'

type FieldDef = { key: string; label: string; secret?: boolean; hint?: string; optional?: boolean }

function gatewayFields(t: AdminDictionary): Record<string, FieldDef[]> {
  return {
    wayforpay: [
      { key: 'merchantAccount', label: 'Merchant login', hint: t.payments.wfpMerchantLoginHint },
      { key: 'merchantSecretKey', label: 'Merchant secret key', secret: true, hint: t.payments.wfpSecretKeyHint },
      { key: 'merchantDomainName', label: 'Merchant Domain', hint: t.payments.wfpDomainHint },
      {
        key: 'merchantPassword',
        label: 'Merchant password',
        secret: true,
        optional: true,
        hint: t.payments.wfpPasswordHint,
      },
    ],
    monobank: [
      { key: 'token', label: t.payments.monobankTokenLabel, secret: true, hint: t.payments.monobankTokenHint },
    ],
  }
}

// Base URL for gateway callbacks — the domain the admin panel is opened on.
// Resolved in an effect to avoid SSR/client hydration mismatches.
function usePublicOrigin(): string {
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])
  return origin
}

function CopyUrlRow({ label, url }: { label: string; url: string }) {
  const { dict: t } = useAdminI18n()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t.payments.copiedToast)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t.payments.copyFailedToast)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          {url}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7 shrink-0"
          onClick={handleCopy}
          aria-label={`${t.payments.copyAria} ${label}`}
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}

function GatewayUrls({ code }: { code: string }) {
  const { dict: t } = useAdminI18n()
  const origin = usePublicOrigin()
  if (!origin) return null

  const rows =
    code === 'wayforpay'
      ? [
          { label: t.payments.serviceUrlLabel, url: `${origin}/api/payments/wayforpay/callback` },
          { label: t.payments.approvedUrlLabel, url: `${origin}/checkout/return` },
        ]
      : [
          { label: t.payments.webhookUrlLabel, url: `${origin}/api/payments/monobank/callback` },
          { label: t.payments.redirectUrlLabel, url: `${origin}/checkout/return` },
        ]

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Link2 className="size-3.5" />
        {t.payments.urlsSectionTitlePrefix} {code === 'wayforpay' ? 'WayForPay' : 'Monobank'}
      </div>
      {rows.map((r) => (
        <CopyUrlRow key={r.url + r.label} label={r.label} url={r.url} />
      ))}
      <p className="text-xs text-muted-foreground">
        {t.payments.urlsHintPrefix}{' '}
        {code === 'wayforpay' ? t.payments.urlsHintWfpSuffix : t.payments.urlsHintMonoSuffix}{' '}
        {t.payments.urlsHintEnd}
      </p>
    </div>
  )
}

function GatewayCard({ gateway }: { gateway: PaymentGateway }) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const fields = gatewayFields(t)[gateway.code] ?? []
  const initialConfig = (gateway.config ?? {}) as Record<string, string>

  const [isActive, setIsActive] = useState(gateway.isActive ?? false)
  const [isTestMode, setIsTestMode] = useState(gateway.isTestMode ?? true)
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const c: Record<string, string> = {}
    for (const f of fields) c[f.key] = initialConfig[f.key] ?? ''
    return c
  })

  const isConfigured = fields
    .filter((f) => !f.optional)
    .every((f) => (config[f.key] ?? '').trim().length > 0)

  function handleSave() {
    if (isActive && !isConfigured) {
      toast.error(t.payments.toastFillFields)
      return
    }
    startTransition(async () => {
      const result = await updateGateway(gateway.code, { isActive, isTestMode, config })
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
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{gateway.name}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {gateway.code === 'wayforpay' ? t.payments.wfpDesc : t.payments.monoDesc}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isActive ? (
            <Badge className="bg-success/15 text-success hover:bg-success/25">{t.payments.badgeActiveGateway}</Badge>
          ) : (
            <Badge variant="secondary">{t.payments.badgeDisabledGateway}</Badge>
          )}
          {isTestMode && (
            <Badge variant="outline" className="border-warning/40 text-warning">
              {t.payments.badgeTestMode}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4">
          {fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-2">
              <Label htmlFor={`${gateway.code}-${f.key}`} className="flex items-center gap-2">
                {f.label}
                {f.optional && (
                  <span className="text-xs font-normal text-muted-foreground">{t.payments.optionalLabel}</span>
                )}
              </Label>
              <Input
                id={`${gateway.code}-${f.key}`}
                type={f.secret ? 'password' : 'text'}
                autoComplete="off"
                value={config[f.key] ?? ''}
                placeholder={f.secret ? '••••••••' : ''}
                onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              />
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>
        <GatewayUrls code={gateway.code} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor={`${gateway.code}-active`}>{t.payments.activeSwitchLabel}</Label>
              <p className="text-xs text-muted-foreground">{t.payments.activeSwitchDesc}</p>
            </div>
            <Switch id={`${gateway.code}-active`} checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor={`${gateway.code}-test`}>{t.payments.testSwitchLabel}</Label>
              <p className="text-xs text-muted-foreground">{t.payments.testSwitchDesc}</p>
            </div>
            <Switch
              id={`${gateway.code}-test`}
              checked={isTestMode}
              onCheckedChange={setIsTestMode}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {t.common.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function GatewaysTab({ gateways }: { gateways: PaymentGateway[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {gateways.map((g) => (
        <GatewayCard key={g.id} gateway={g} />
      ))}
    </div>
  )
}
