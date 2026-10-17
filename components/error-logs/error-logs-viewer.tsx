'use client'

import { Fragment, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  getErrorLogs,
  setErrorLogResolved,
  clearResolvedErrorLogs,
  type ErrorLogRow,
} from '@/app/actions/error-logs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, ChevronDown, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'

type T = AdminDictionary['errorLogs']

function tpl(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    template,
  )
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(locale === 'ru' ? 'ru-RU' : 'uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  })
}

export function ErrorLogsViewer({
  initial,
  tags,
  t,
}: {
  initial: ErrorLogRow[]
  tags: string[]
  t: T
}) {
  const { locale } = useAdminI18n()
  const [items, setItems] = useState<ErrorLogRow[]>(initial)
  const [tag, setTag] = useState('all')
  const [showResolved, setShowResolved] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const load = (resolved: boolean, tagFilter: string) => {
    startTransition(async () => {
      const rows = await getErrorLogs({
        resolved: resolved ? undefined : false,
        tag: tagFilter === 'all' ? undefined : tagFilter,
      })
      setItems(rows)
      setExpanded(null)
    })
  }

  const toggleResolved = (row: ErrorLogRow) => {
    startTransition(async () => {
      await setErrorLogResolved(row.id, !row.resolved)
      load(showResolved, tag)
    })
  }

  const clearResolved = () => {
    if (!window.confirm(t.clearResolvedConfirm)) return
    startTransition(async () => {
      const { deleted } = await clearResolvedErrorLogs()
      toast.success(tpl(t.clearedTemplate, { n: deleted }))
      load(showResolved, tag)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.pageSubtitle}</p>
      </header>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select
            value={tag}
            onValueChange={(v) => {
              setTag(v)
              load(showResolved, v)
            }}
          >
            <SelectTrigger className="w-full md:w-56" aria-label={t.filterByTag}>
              <SelectValue placeholder={t.filterByTag} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allTags}</SelectItem>
              {tags.map((tg) => (
                <SelectItem key={tg} value={tg}>
                  {tg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              const next = !showResolved
              setShowResolved(next)
              load(next, tag)
            }}
          >
            {showResolved ? t.hideResolved : t.showResolved}
          </Button>
          <div className="md:ml-auto">
            <Button variant="outline" disabled={pending} onClick={clearResolved}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {t.clearResolved}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.colTime}</TableHead>
                <TableHead>{t.colTag}</TableHead>
                <TableHead>{t.colMessage}</TableHead>
                <TableHead>{t.colCount}</TableHead>
                <TableHead>{t.colLastSeen}</TableHead>
                <TableHead>{t.colActions}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {t.noRecords}
                  </TableCell>
                </TableRow>
              )}
              {items.map((row) => {
                const isOpen = expanded === row.id
                return (
                  <Fragment key={row.id}>
                    <TableRow className={isOpen ? 'border-b-0' : undefined}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(row.firstSeen, locale)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {row.tag}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{row.message}</TableCell>
                      <TableCell>
                        {row.occurrences > 1 ? (
                          <Badge variant="secondary">{row.occurrences}</Badge>
                        ) : (
                          <span className="text-muted-foreground">1</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(row.lastSeen, locale)}
                      </TableCell>
                      <TableCell>
                        {row.resolved ? (
                          <Badge
                            variant="outline"
                            className="border-0 bg-success/15 text-success"
                          >
                            {t.resolvedBadge}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-0 bg-destructive/10 text-destructive"
                          >
                            {t.unresolvedBadge}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            onClick={() => toggleResolved(row)}
                            title={
                              row.resolved ? t.markUnresolved : t.markResolved
                            }
                          >
                            {row.resolved ? (
                              <RotateCcw className="size-4" />
                            ) : (
                              <Check className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setExpanded(isOpen ? null : row.id)}
                            aria-label={t.contextTitle}
                          >
                            <ChevronDown
                              className={`size-4 transition-transform ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="px-2 py-1">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              {t.contextTitle}
                            </p>
                            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                              {row.context != null
                                ? JSON.stringify(row.context, null, 2)
                                : '—'}
                            </pre>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
