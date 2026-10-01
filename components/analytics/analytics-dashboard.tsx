'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Save, Info } from 'lucide-react'
import {
  saveCampaignSpend,
  type CampaignReportResult,
  type CheckoutFunnelResult,
} from '@/app/actions/analytics'
import { DIRECT_SOURCE_SENTINEL } from '@/lib/analytics/roas'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function numberLocale(locale: string) {
  return locale === 'ru' ? 'ru-RU' : 'uk-UA'
}

function money(n: number, locale: string) {
  return `${Math.round(n).toLocaleString(numberLocale(locale))} ₴`
}

function formatCount(n: number, locale: string) {
  return n.toLocaleString(numberLocale(locale))
}

function formatRoas(roas: number | null) {
  if (roas == null) return '—'
  return `${roas.toFixed(2)}×`
}

const STEP_KEYS = ['carts', 'checkoutVisits', 'orders', 'paidOrders', 'fulfilledOrders'] as const

function stepLabel(t: AdminDictionary['analytics'], key: (typeof STEP_KEYS)[number]): string {
  switch (key) {
    case 'carts':
      return t.stepCarts
    case 'checkoutVisits':
      return t.stepCheckoutVisits
    case 'orders':
      return t.stepOrders
    case 'paidOrders':
      return t.stepPaid
    case 'fulfilledOrders':
      return t.stepFulfilled
  }
}

function untrackedLabel(t: AdminDictionary['analytics'], key: string): string {
  switch (key) {
    case 'contacts':
      return t.untrackedContacts
    case 'delivery':
      return t.untrackedDelivery
    default:
      return t.untrackedPayment
  }
}

export function AnalyticsDashboard({
  report,
  funnel,
}: {
  report: CampaignReportResult
  funnel: CheckoutFunnelResult
}) {
  const router = useRouter()
  const { dict, locale } = useAdminI18n()
  const t = dict.analytics
  // Spend inputs keyed by the (source, medium, campaign) triple — the same
  // key saveCampaignSpend matches on.
  const [spend, setSpend] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      report.rows
        .filter((r) => r.spend != null)
        .map((r) => [`${r.source}\u0000${r.medium}\u0000${r.campaign}`, String(r.spend)]),
    ),
  )
  const [saving, setSaving] = useState(false)

  const applyDates = (form: HTMLFormElement) => {
    const data = new FormData(form)
    const from = String(data.get('from') ?? '')
    const to = String(data.get('to') ?? '')
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    router.push(`/admin/analytics?${params.toString()}`)
  }

  const saveSpend = async () => {
    setSaving(true)
    try {
      const entries = report.rows.map((r) => ({
        source: r.source,
        medium: r.medium,
        campaign: r.campaign,
        spend: spend[`${r.source}\u0000${r.medium}\u0000${r.campaign}`] ?? '',
      }))
      const res = await saveCampaignSpend(entries)
      if (res.success) {
        toast.success(t.spendSaved)
        router.refresh()
      } else {
        toast.error(t.spendSaveError)
      }
    } catch {
      toast.error(t.spendSaveError)
    } finally {
      setSaving(false)
    }
  }

  const maxFunnel = Math.max(1, ...funnel.stages.map((s) => s.value))

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.pageTitle}</h1>
        <p className="text-muted-foreground">{t.pageSubtitle}</p>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          applyDates(e.currentTarget)
        }}
      >
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t.fromLabel}</span>
          <Input type="date" name="from" defaultValue={report.from} className="w-40" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{t.toLabel}</span>
          <Input type="date" name="to" defaultValue={report.to} className="w-40" />
        </label>
        <Button type="submit">{t.applyButton}</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{t.roasTitle}</CardTitle>
          <CardDescription>{t.roasHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {report.rows.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">{t.emptyReport}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.colSource}</TableHead>
                    <TableHead>{t.colMedium}</TableHead>
                    <TableHead>{t.colCampaign}</TableHead>
                    <TableHead className="text-right">{t.colOrders}</TableHead>
                    <TableHead className="text-right">{t.colRevenue}</TableHead>
                    <TableHead className="text-right">{t.colSpend}</TableHead>
                    <TableHead className="text-right">{t.colRoas}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((r) => {
                    const key = `${r.source}\u0000${r.medium}\u0000${r.campaign}`
                    const isDirect = r.source === DIRECT_SOURCE_SENTINEL
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">
                          {isDirect ? dict.statistics.directTraffic : r.source}
                        </TableCell>
                        <TableCell>{r.medium || '—'}</TableCell>
                        <TableCell>{r.campaign || '—'}</TableCell>
                        <TableCell className="text-right">{formatCount(r.orders, locale)}</TableCell>
                        <TableCell className="text-right">{money(r.revenue, locale)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            className="ml-auto w-28 text-right"
                            placeholder={t.spendPlaceholder}
                            value={spend[key] ?? ''}
                            onChange={(e) =>
                              setSpend((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatRoas(r.roas)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={3}>{t.totalRow}</TableCell>
                    <TableCell className="text-right">
                      {formatCount(report.totals.orders, locale)}
                    </TableCell>
                    <TableCell className="text-right">{money(report.totals.revenue, locale)}</TableCell>
                    <TableCell className="text-right">
                      {report.totals.spend == null ? t.noSpend : money(report.totals.spend, locale)}
                    </TableCell>
                    <TableCell className="text-right">{formatRoas(report.totals.roas)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-end">
                <Button onClick={saveSpend} disabled={saving}>
                  <Save className="mr-2 size-4" />
                  {t.saveSpendButton}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.funnelTitle}</CardTitle>
          <CardDescription>{t.funnelSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span>{t.funnelLimitation}</span>
          </div>

          {funnel.stages.map((stage, i) => (
            <div key={stage.key} className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">
                  {i + 1}. {stepLabel(t, stage.key)}
                </span>
                <span className="text-muted-foreground">
                  {formatCount(stage.value, locale)}
                  {stage.conversionFromPrev != null && (
                    <span className="ml-2 text-xs">
                      {stage.conversionFromPrev.toFixed(1)}% · {t.conversionFromPrev}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(stage.value / maxFunnel) * 100}%` }}
                />
              </div>
              {stage.dropOff != null && stage.dropOff > 0 && (
                <p className="text-xs text-muted-foreground">
                  −{formatCount(stage.dropOff, locale)} · {t.dropOff}
                </p>
              )}
            </div>
          ))}

          {funnel.untrackedSteps.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.untrackedHint}
              </p>
              <div className="flex flex-wrap gap-2">
                {funnel.untrackedSteps.map((key) => (
                  <span
                    key={key}
                    className="rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground"
                    title={t.funnelLimitation}
                  >
                    {untrackedLabel(t, key)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
