'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createPayment,
  refreshPaymentStatus,
  refundPayment,
  markPaymentPaid,
} from '@/app/actions/payments'
import type { PaymentGateway, Payment, PaymentMethod } from '@/lib/db/schema'
import { GatewaysTab } from './gateways-tab'
import { PaymentMethodsTab } from './payment-methods-tab'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Plus,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  CreditCard,
  Wallet,
  Undo2,
  Clock,
  ListChecks,
} from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'

function statusMeta(t: AdminDictionary, status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    created: { label: t.payments.statusCreated, className: 'bg-muted text-muted-foreground' },
    pending: { label: t.payments.statusPending, className: 'bg-warning/15 text-warning' },
    paid: { label: t.payments.statusPaid, className: 'bg-success/15 text-success' },
    partially_refunded: { label: t.payments.statusPartiallyRefunded, className: 'bg-primary/15 text-primary' },
    refunded: { label: t.payments.statusRefunded, className: 'bg-primary/15 text-primary' },
    failed: { label: t.payments.statusFailed, className: 'bg-destructive/15 text-destructive' },
    expired: { label: t.payments.statusExpired, className: 'bg-muted text-muted-foreground' },
  }
  return map[status] ?? map.created
}

function money(v: string | number, currency: string) {
  return `${Number(v).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

const emptyForm = {
  gatewayCode: '',
  amount: '',
  currency: 'UAH',
  description: '',
  customerName: '',
  customerEmail: '',
  customerPhone: '',
}

export function PaymentsManager({
  gateways,
  payments,
  methods,
}: {
  gateways: PaymentGateway[]
  payments: Payment[]
  methods: PaymentMethod[]
}) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [refunding, setRefunding] = useState<Payment | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [actingId, setActingId] = useState<number | null>(null)

  const activeGateways = gateways.filter((g) => g.isActive)
  const testModeByCode = useMemo(
    () => Object.fromEntries(gateways.map((g) => [g.code, g.isTestMode])),
    [gateways],
  )

  const stats = useMemo(() => {
    let paid = 0
    let refunded = 0
    let pending = 0
    for (const p of payments) {
      if (p.status === 'paid' || p.status === 'partially_refunded') paid += Number(p.amount)
      refunded += Number(p.refundedAmount)
      if (p.status === 'pending' || p.status === 'created') pending += 1
    }
    return { paid, refunded, pending, total: payments.length }
  }, [payments])

  function gatewayName(code: string) {
    return gateways.find((g) => g.code === code)?.name ?? code
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.gatewayCode) {
      toast.error(t.payments.toastSelectGateway)
      return
    }
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      toast.error(t.payments.toastInvalidAmount)
      return
    }
    startTransition(async () => {
      const result = await createPayment({
        gatewayCode: form.gatewayCode,
        amount,
        currency: form.currency,
        description: form.description,
        customerName: form.customerName || undefined,
        customerEmail: form.customerEmail || undefined,
        customerPhone: form.customerPhone || undefined,
      })
      if (result.ok) {
        toast.success(result.message)
        setCreateOpen(false)
        setForm({ ...emptyForm })
        router.refresh()
        if (result.paymentUrl) window.open(result.paymentUrl, '_blank', 'noopener')
      } else {
        toast.error(result.message)
      }
    })
  }

  function handleRefresh(p: Payment) {
    setActingId(p.id)
    startTransition(async () => {
      const result = await refreshPaymentStatus(p.id)
      result.ok ? toast.success(result.message) : toast.error(result.message)
      setActingId(null)
      router.refresh()
    })
  }

  function handleMarkPaid(p: Payment) {
    setActingId(p.id)
    startTransition(async () => {
      const result = await markPaymentPaid(p.id)
      result.ok ? toast.success(result.message) : toast.error(result.message)
      setActingId(null)
      router.refresh()
    })
  }

  function openRefund(p: Payment) {
    const remaining = Number(p.amount) - Number(p.refundedAmount)
    setRefunding(p)
    setRefundAmount(remaining.toFixed(2))
  }

  function handleRefund() {
    if (!refunding) return
    const amount = Number(refundAmount)
    if (!amount || amount <= 0) {
      toast.error(t.payments.toastRefundAmount)
      return
    }
    startTransition(async () => {
      const result = await refundPayment(refunding.id, amount)
      result.ok ? toast.success(result.message) : toast.error(result.message)
      setRefunding(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-balance">{t.payments.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.payments.pageSubtitle}</p>
        </div>
      </header>

      <Tabs defaultValue="processing" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="processing">
            <Wallet className="size-4" />
            {t.payments.tabProcessing}
          </TabsTrigger>
          <TabsTrigger value="methods">
            <ListChecks className="size-4" />
            {t.payments.tabMethods}
          </TabsTrigger>
          <TabsTrigger value="gateways">
            <CreditCard className="size-4" />
            {t.payments.tabGateways}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="processing" className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Wallet} label={t.payments.statTotal} value={String(stats.total)} />
            <StatCard
              icon={CheckCircle2}
              label={t.payments.statPaid}
              value={money(stats.paid, 'UAH')}
              accent="success"
            />
            <StatCard
              icon={Undo2}
              label={t.payments.statRefunded}
              value={money(stats.refunded, 'UAH')}
              accent="primary"
            />
            <StatCard icon={Clock} label={t.payments.statPending} value={String(stats.pending)} accent="warning" />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setForm({ ...emptyForm, gatewayCode: activeGateways[0]?.code ?? '' })
                setCreateOpen(true)
              }}
            >
              <Plus className="size-4" />
              {t.payments.createButton}
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>{t.payments.colOrder}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.payments.colGateway}</TableHead>
                  <TableHead className="text-right">{t.payments.colAmount}</TableHead>
                  <TableHead>{t.payments.colStatus}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t.payments.colCustomer}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t.payments.colDate}</TableHead>
                  <TableHead className="w-16 text-right">{t.payments.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Wallet className="size-8" />
                        <p className="text-sm">{t.payments.emptyPayments}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => {
                    const meta = statusMeta(t, p.status)
                    const refunded = Number(p.refundedAmount)
                    const canRefund = p.status === 'paid' || p.status === 'partially_refunded'
                    const isTest = testModeByCode[p.gatewayCode]
                    const busy = isPending && actingId === p.id
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-mono text-xs">{p.orderReference}</p>
                          {p.description && (
                            <p className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">
                              {p.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm">{gatewayName(p.gatewayCode)}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <p className="font-medium">{money(p.amount, p.currency)}</p>
                          {refunded > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {t.payments.refundedPrefix} {money(refunded, p.currency)}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${meta.className} hover:${meta.className}`}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-sm">{p.customerName || '—'}</span>
                          {p.customerEmail && (
                            <p className="text-xs text-muted-foreground">{p.customerEmail}</p>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-right text-xs text-muted-foreground tabular-nums sm:table-cell">
                          {p.createdAt ? new Date(p.createdAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" disabled={busy}>
                                {busy ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="size-4" />
                                )}
                                <span className="sr-only">{t.payments.colActions}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {p.paymentUrl && (
                                <DropdownMenuItem asChild>
                                  <a href={p.paymentUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="size-4" />
                                    {t.payments.openPayment}
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleRefresh(p)}>
                                <RefreshCw className="size-4" />
                                {t.payments.refreshStatus}
                              </DropdownMenuItem>
                              {isTest && p.status !== 'paid' && p.status !== 'refunded' && (
                                <DropdownMenuItem onClick={() => handleMarkPaid(p)}>
                                  <CheckCircle2 className="size-4" />
                                  {t.payments.markPaid}
                                </DropdownMenuItem>
                              )}
                              {canRefund && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => openRefund(p)}
                                  >
                                    <RotateCcw className="size-4" />
                                    {t.payments.refundAction}
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="methods">
          <PaymentMethodsTab methods={methods} gateways={gateways} />
        </TabsContent>

        <TabsContent value="gateways">
          <GatewaysTab gateways={gateways} />
        </TabsContent>
      </Tabs>

      {/* Create payment dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.payments.newPaymentTitle}</DialogTitle>
            <DialogDescription>{t.payments.newPaymentDesc}</DialogDescription>
          </DialogHeader>
          {activeGateways.length === 0 ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              {t.payments.noActiveGateways}
            </div>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payGateway">{t.payments.gatewayLabel}</Label>
                  <Select
                    value={form.gatewayCode}
                    onValueChange={(v) => setForm((f) => ({ ...f, gatewayCode: v }))}
                  >
                    <SelectTrigger id="payGateway">
                      <SelectValue placeholder={t.payments.gatewaySelectPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeGateways.map((g) => (
                        <SelectItem key={g.code} value={g.code}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payCurrency">{t.payments.currencyLabel}</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                  >
                    <SelectTrigger id="payCurrency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UAH">UAH</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payAmount">{t.payments.amountLabel}</Label>
                <Input
                  id="payAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payDesc">{t.payments.descLabel}</Label>
                <Textarea
                  id="payDesc"
                  rows={2}
                  placeholder={t.payments.descPlaceholder}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payName">{t.payments.customerLabel}</Label>
                  <Input
                    id="payName"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="payPhone">{t.payments.phoneLabel}</Label>
                  <Input
                    id="payPhone"
                    value={form.customerPhone}
                    onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="payEmail">{t.payments.emailLabel}</Label>
                <Input
                  id="payEmail"
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  {t.payments.createInvoiceButton}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={refunding !== null} onOpenChange={(open) => !open && setRefunding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.payments.refundDialogTitle}</DialogTitle>
            <DialogDescription>
              {refunding && (
                <>
                  {t.payments.refundDialogDescPrefix} {refunding.orderReference} —{' '}
                  {money(refunding.amount, refunding.currency)}. {t.payments.refundDialogAlreadyRefunded}{' '}
                  {money(refunding.refundedAmount, refunding.currency)}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="refundAmount">{t.payments.refundAmountLabel}</Label>
            <Input
              id="refundAmount"
              type="number"
              step="0.01"
              min="0"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t.payments.refundHintPrefix} {refunding ? gatewayName(refunding.gatewayCode) : ''}.{' '}
              {t.payments.refundHintSuffix}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRefunding(null)}>
              {t.common.cancel}
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRefund}
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t.payments.confirmRefundButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  accent?: 'success' | 'primary' | 'warning'
}) {
  const accentClass =
    accent === 'success'
      ? 'bg-success/10 text-success'
      : accent === 'primary'
        ? 'bg-primary/10 text-primary'
        : accent === 'warning'
          ? 'bg-warning/10 text-warning'
          : 'bg-muted text-muted-foreground'
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
