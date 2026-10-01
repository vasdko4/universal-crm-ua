'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Database, Loader2, RefreshCw, Rocket } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { Button } from '@/components/ui/button'
import {
  getDbMigrationStatus,
  applyDbMigrations,
  type MigrationStatus,
} from '@/app/actions/db-migrate'

export function DbSchemaPanel() {
  const { dict: t, locale } = useAdminI18n()
  const [status, setStatus] = useState<MigrationStatus | null>(null)
  const [isPending, startTransition] = useTransition()

  function refresh() {
    startTransition(async () => {
      const nextStatus = await getDbMigrationStatus()
      setStatus(nextStatus)
      if (!nextStatus.ok) toast.error(t.updates.dbCheckError)
    })
  }

  useEffect(() => {
    startTransition(async () => {
      setStatus(await getDbMigrationStatus())
    })
  }, [])

  function handleApply() {
    startTransition(async () => {
      const result = await applyDbMigrations()
      if (result.ok) {
        toast.success(t.updates.dbAppliedTitle, { description: t.updates.dbAppliedDesc })
        setStatus(await getDbMigrationStatus())
      } else {
        toast.error(t.updates.dbApplyErrorTitle, {
          description: result.error || t.updates.dbApplyErrorDesc,
        })
      }
    })
  }

  const appliedDate =
    status?.appliedAt != null
      ? new Date(status.appliedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'uk-UA')
      : t.updates.dbNeverApplied

  return (
    <div className="max-w-xl rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Database className="size-5 text-muted-foreground" />
          <div>
            <h2 className="text-base font-semibold text-foreground">{t.updates.dbSchemaTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.updates.dbSchemaDesc}</p>
          </div>
        </div>

        {status == null || isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t.updates.dbChecking}
          </div>
        ) : !status.ok ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{t.updates.dbCheckError}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t.updates.dbVersionLabel}</span>
              <span className="font-mono text-sm font-semibold text-foreground">
                {status.currentVersion.slice(0, 8)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t.updates.dbAppliedAtLabel}</span>
              <span className="text-sm text-foreground">{appliedDate}</span>
            </div>
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                status.upToDate
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              {status.upToDate ? (
                <>
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{t.updates.dbUpToDate}</span>
                </>
              ) : (
                <>
                  <Rocket className="size-4 shrink-0" />
                  <span>{t.updates.dbUpdateAvailable}</span>
                </>
              )}
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={refresh} disabled={isPending}>
            <RefreshCw className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
            {t.updates.dbCheckButton}
          </Button>
          {status?.ok && !status.upToDate && (
            <Button type="button" onClick={handleApply} disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
              {isPending ? t.updates.dbApplying : t.updates.dbApplyButton}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
