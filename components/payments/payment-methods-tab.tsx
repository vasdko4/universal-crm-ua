'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updatePaymentMethod } from '@/app/actions/settings'
import type { PaymentMethod, PaymentGateway } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Banknote, CreditCard, Landmark, Loader2, Save } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

function StatusBadge({ active }: { active: boolean }) {
  const { dict: t } = useAdminI18n()
  return active ? (
    <Badge className="bg-success/15 text-success hover:bg-success/25">{t.payments.statusEnabled}</Badge>
  ) : (
    <Badge variant="secondary">{t.payments.statusDisabledMethod}</Badge>
  )
}

/* --------------------------- Наложенный платёж / Онлайн --------------------------- */

function ToggleMethodCard({
  method,
  icon: Icon,
  hint,
  extra,
}: {
  method: PaymentMethod
  icon: typeof Banknote
  hint: string
  extra?: React.ReactNode
}) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isActive, setIsActive] = useState(method.isActive ?? false)

  function handleToggle(next: boolean) {
    setIsActive(next)
    startTransition(async () => {
      const result = await updatePaymentMethod(method.code, { isActive: next, config: {} })
      if (result.ok) {
        toast.success(
          `${method.name}: ${next ? t.payments.toastMethodEnabledSuffix : t.payments.toastMethodDisabledSuffix}`,
        )
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
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{method.name}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
        <StatusBadge active={isActive} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor={`${method.code}-active`}>{t.payments.availableAtCheckoutLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.payments.customerCanChooseDesc}</p>
          </div>
          <div className="flex items-center gap-2">
            {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <Switch
              id={`${method.code}-active`}
              checked={isActive}
              disabled={isPending}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>
        {extra}
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Оплата по реквизитам ------------------------------ */

function RequisitesCard({ method }: { method: PaymentMethod }) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const initial = (method.config ?? {}) as Record<string, string>

  const [isActive, setIsActive] = useState(method.isActive ?? false)
  const [mode, setMode] = useState<'card' | 'requisites'>(
    initial.mode === 'requisites' ? 'requisites' : 'card',
  )
  const [cardNumber, setCardNumber] = useState(initial.cardNumber ?? '')
  const [cardHolder, setCardHolder] = useState(initial.cardHolder ?? '')
  const [edrpou, setEdrpou] = useState(initial.edrpou ?? '')
  const [recipientName, setRecipientName] = useState(initial.recipientName ?? '')
  const [iban, setIban] = useState(initial.iban ?? '')

  function handleSave() {
    if (isActive) {
      if (mode === 'card' && (!cardNumber.trim() || !cardHolder.trim())) {
        toast.error(t.payments.toastCardFieldsRequired)
        return
      }
      if (mode === 'requisites' && (!edrpou.trim() || !recipientName.trim() || !iban.trim())) {
        toast.error(t.payments.toastRequisitesFieldsRequired)
        return
      }
    }
    startTransition(async () => {
      const config: Record<string, string> = { mode }
      if (mode === 'card') {
        config.cardNumber = cardNumber
        config.cardHolder = cardHolder
      } else {
        config.edrpou = edrpou
        config.recipientName = recipientName
        config.iban = iban
      }
      const result = await updatePaymentMethod('requisites', { isActive, config })
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
            <Landmark className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base">{method.name}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.payments.requisitesDesc}</p>
          </div>
        </div>
        <StatusBadge active={isActive} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="requisites-active">{t.payments.availableAtCheckoutLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.payments.customerCanChooseDesc}</p>
          </div>
          <Switch id="requisites-active" checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">{t.payments.requisitesTypeLabel}</Label>
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'card' | 'requisites')}>
            <TabsList>
              <TabsTrigger value="card" className="gap-1.5">
                <CreditCard className="size-4" /> {t.payments.tabCard}
              </TabsTrigger>
              <TabsTrigger value="requisites" className="gap-1.5">
                <Landmark className="size-4" /> {t.payments.tabRequisites}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {mode === 'card' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="req-card">{t.payments.cardNumberLabel}</Label>
              <Input
                id="req-card"
                inputMode="numeric"
                value={cardNumber}
                placeholder="0000 0000 0000 0000"
                onChange={(e) => setCardNumber(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="req-card-holder">{t.payments.cardHolderLabel}</Label>
              <Input
                id="req-card-holder"
                value={cardHolder}
                placeholder="Иванов Иван Иванович"
                onChange={(e) => setCardHolder(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="req-edrpou">{t.payments.edrpouLabel}</Label>
              <Input
                id="req-edrpou"
                inputMode="numeric"
                value={edrpou}
                placeholder="12345678"
                onChange={(e) => setEdrpou(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="req-name">{t.payments.recipientNameLabel}</Label>
              <Input
                id="req-name"
                value={recipientName}
                placeholder="ФЛП Иванов И.И."
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="req-iban">{t.payments.ibanLabel}</Label>
              <Input
                id="req-iban"
                value={iban}
                placeholder="UA00 0000 0000 0000 0000 0000 00000"
                onChange={(e) => setIban(e.target.value)}
              />
            </div>
          </div>
        )}

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

export function PaymentMethodsTab({
  methods,
  gateways,
}: {
  methods: PaymentMethod[]
  gateways: PaymentGateway[]
}) {
  const { dict: t } = useAdminI18n()
  const cod = methods.find((m) => m.code === 'cod')
  const online = methods.find((m) => m.code === 'online')
  const requisites = methods.find((m) => m.code === 'requisites')
  const activeGateways = gateways.filter((g) => g.isActive)

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {cod && (
        <ToggleMethodCard
          method={cod}
          icon={Banknote}
          hint={t.payments.codHint}
        />
      )}
      {online && (
        <ToggleMethodCard
          method={online}
          icon={CreditCard}
          hint={t.payments.onlineHint}
          extra={
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              {activeGateways.length > 0 ? (
                <span>
                  {t.payments.activeGatewaysPrefix}{' '}
                  <span className="font-medium text-foreground">
                    {activeGateways.map((g) => g.name).join(', ')}
                  </span>
                </span>
              ) : (
                <span>{t.payments.noActiveGatewaysHint}</span>
              )}
            </div>
          }
        />
      )}
      {requisites && <RequisitesCard method={requisites} />}
    </div>
  )
}
