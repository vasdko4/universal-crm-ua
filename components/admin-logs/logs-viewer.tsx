'use client'

import { useState, useTransition } from 'react'
import { getAdminLogs, clearAdminLogs, type LogsResult } from '@/app/actions/admin-logs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Search, Trash2, Loader2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'

function tpl(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    template,
  )
}

function actionLabels(t: AdminDictionary): Record<string, { label: string; tone: string }> {
  return {
    login: { label: t.logs.actionLogin, tone: 'bg-primary/10 text-primary' },
    create: { label: t.logs.actionCreate, tone: 'bg-success/15 text-success' },
    update: { label: t.logs.actionUpdate, tone: 'bg-muted text-foreground' },
    delete: { label: t.logs.actionDelete, tone: 'bg-destructive/10 text-destructive' },
    toggle: { label: t.logs.actionToggle, tone: 'bg-muted text-foreground' },
    settings: { label: t.logs.actionSettings, tone: 'bg-muted text-foreground' },
    security: { label: t.logs.actionSecurity, tone: 'bg-destructive/10 text-destructive' },
  }
}

function entityLabels(t: AdminDictionary): Record<string, string> {
  return {
    auth: t.logs.entityAuth,
    product: t.logs.entityProduct,
    order: t.logs.entityOrder,
    user: t.logs.entityUser,
    settings: t.logs.entitySettings,
    modal_ad: t.logs.entityModalAd,
    promotion: t.logs.entityPromotion,
    category: t.logs.entityCategory,
    logs: t.logs.entityLogs,
    role: t.logs.entityRole,
  }
}

function formatDate(value: string | Date | null): string {
  if (!value) return '—'
  const d = new Date(value)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  })
}

export function LogsViewer({ initial }: { initial: LogsResult }) {
  const { dict: t } = useAdminI18n()
  const ACTION_LABELS = actionLabels(t)
  const ENTITY_LABELS = entityLabels(t)
  const [data, setData] = useState<LogsResult>(initial)
  const [search, setSearch] = useState('')
  const [entity, setEntity] = useState('all')
  const [action, setAction] = useState('all')
  const [pending, startTransition] = useTransition()

  const load = (page = 1, s = search, e = entity, a = action) => {
    startTransition(async () => {
      const res = await getAdminLogs({
        page,
        search: s || undefined,
        entity: e === 'all' ? undefined : e,
        action: a === 'all' ? undefined : a,
      })
      setData(res)
    })
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t.logs.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.logs.pageSubtitle}</p>
      </header>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) load(1)
              }}
              placeholder={t.logs.searchPlaceholder}
              className="pl-9"
              aria-label={t.logs.searchPlaceholder}
            />
          </div>
          <Select
            value={entity}
            onValueChange={(v) => {
              setEntity(v)
              load(1, search, v, action)
            }}
          >
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder={t.logs.sectionPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.logs.allSections}</SelectItem>
              {data.entities.map((e) => (
                <SelectItem key={e} value={e}>
                  {ENTITY_LABELS[e] ?? e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={action}
            onValueChange={(v) => {
              setAction(v)
              load(1, search, entity, v)
            }}
          >
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder={t.logs.actionPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.logs.allActions}</SelectItem>
              {Object.entries(ACTION_LABELS).map(([key, v]) => (
                <SelectItem key={key} value={key}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => load(data.page)} disabled={pending} aria-label={t.logs.refreshAria}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t.logs.clearAria}>
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.logs.clearTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{t.logs.clearDescription}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      startTransition(async () => {
                        await clearAdminLogs(90)
                        load(1)
                      })
                    }
                  >
                    {t.logs.clearButton}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t.logs.colDate}</th>
                <th className="px-4 py-3 font-medium">{t.logs.colUser}</th>
                <th className="px-4 py-3 font-medium">{t.logs.colAction}</th>
                <th className="px-4 py-3 font-medium">{t.logs.colSection}</th>
                <th className="px-4 py-3 font-medium">{t.logs.colDetails}</th>
                <th className="px-4 py-3 font-medium">{t.logs.colIp}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {t.logs.noRecords}
                  </td>
                </tr>
              )}
              {data.items.map((log) => {
                const a = ACTION_LABELS[log.action] ?? { label: log.action, tone: 'bg-muted text-foreground' }
                return (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(log.createdAt as unknown as string)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{log.userName ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{log.userEmail ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`border-0 ${a.tone}`}>
                        {a.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ENTITY_LABELS[log.entity] ?? log.entity}
                      {log.entityId ? ` #${log.entityId}` : ''}
                    </td>
                    <td className="max-w-md px-4 py-3 text-muted-foreground">
                      <span className="line-clamp-2">{log.details ?? '—'}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{log.ip ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {tpl(t.logs.pageOfTotalTemplate, { page: data.page, total: totalPages, count: data.total })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1 || pending}
                onClick={() => load(data.page - 1)}
              >
                <ChevronLeft className="size-4" />
                {t.logs.backButton}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= totalPages || pending}
                onClick={() => load(data.page + 1)}
              >
                {t.logs.forwardButton}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
