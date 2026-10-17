'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Play } from 'lucide-react'
import {
  getCronJobsAdmin,
  setCronJobEnabledAction,
  runCronJobNow,
  type CronJobAdminRow,
} from '@/app/actions/cron'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type CronDict = AdminDictionary['cron']

function formatDate(value: string | null, locale: string): string {
  if (!value) return ''
  const d = new Date(value)
  return d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Kyiv',
  })
}

function StatusBadge({ job, t }: { job: CronJobAdminRow; t: CronDict }) {
  if (!job.enabled) {
    return (
      <Badge variant="outline" className="border-0 bg-muted text-muted-foreground">
        {t.statusDisabled}
      </Badge>
    )
  }
  if (job.lastStatus === 'ok') {
    return (
      <Badge variant="outline" className="border-0 bg-success/15 text-success">
        {t.statusOk}
      </Badge>
    )
  }
  if (job.lastStatus === 'error') {
    return (
      <Badge
        variant="outline"
        className="border-0 bg-destructive/10 text-destructive"
        title={job.lastError ?? undefined}
      >
        {t.statusError}
      </Badge>
    )
  }
  return <span className="text-muted-foreground">—</span>
}

export function CronManager({ initial, t }: { initial: CronJobAdminRow[]; t: CronDict }) {
  const router = useRouter()
  const { locale } = useAdminI18n()
  const [jobs, setJobs] = useState<CronJobAdminRow[]>(initial)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const reload = () => {
    startTransition(async () => {
      setJobs(await getCronJobsAdmin())
    })
  }

  const toggle = async (job: CronJobAdminRow, enabled: boolean) => {
    setTogglingId(job.id)
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, enabled } : j)))
    const res = await setCronJobEnabledAction(job.id, enabled)
    setTogglingId(null)
    if (!res.ok) {
      // Revert the optimistic switch flip so the UI matches the DB.
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, enabled: job.enabled } : j)))
      toast.error(t.toggleError)
    } else {
      router.refresh()
    }
  }

  const runNow = async (job: CronJobAdminRow) => {
    if (!window.confirm(t.runNowTitle)) return
    setRunningId(job.id)
    const res = await runCronJobNow(job.id)
    setRunningId(null)
    if (!res.ok) {
      toast.error(res.error ?? t.toggleError)
    }
    reload()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">{t.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.pageSubtitle}</p>
      </header>

      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          {t.promManagedNote}{' '}
          <Link
            href="/admin/settings"
            className="font-medium text-primary underline underline-offset-4"
          >
            {t.promManagedLink}
          </Link>
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.colJob}</TableHead>
                <TableHead>{t.colSchedule}</TableHead>
                <TableHead>{t.colLastRun}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
                <TableHead>{t.colEnabled}</TableHead>
                <TableHead className="text-right">{t.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const name = t[job.nameKey as keyof CronDict]
                const desc = t[job.descKey as keyof CronDict]
                const running = runningId === job.id
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{name || job.id}</div>
                      <div className="text-xs text-muted-foreground">{desc || ''}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {job.intervalMs >= 86_400_000 ? t.everyDay : t.everyHour}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {job.lastRunAt ? formatDate(job.lastRunAt, locale) : t.neverRun}
                    </TableCell>
                    <TableCell>
                      <StatusBadge job={job} t={t} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={job.enabled}
                          disabled={togglingId === job.id || running}
                          onCheckedChange={(v) => toggle(job, v)}
                          aria-label={job.enabled ? t.enabledLabel : t.disabledLabel}
                        />
                        <span className="text-xs text-muted-foreground">
                          {job.enabled ? t.enabledLabel : t.disabledLabel}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={running || !job.enabled}
                        onClick={() => runNow(job)}
                        title={t.runNowTitle}
                      >
                        {running ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Play className="size-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">
                          {running ? t.running : t.runNow}
                        </span>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
