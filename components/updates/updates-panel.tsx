'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Rocket } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { isNewerVersion } from '@/lib/version'
import { Button } from '@/components/ui/button'
import { triggerSelfUpdate } from '@/app/actions/system-update'

export function UpdatesPanel({
  currentVersion,
  latestVersion,
  changelogUrl,
  updaterConfigured,
}: {
  currentVersion: string | null
  latestVersion: string | null
  changelogUrl: string
  updaterConfigured: boolean
}) {
  const { dict: t } = useAdminI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [updateStarted, setUpdateStarted] = useState(false)

  const hasUpdate = Boolean(currentVersion && latestVersion && isNewerVersion(latestVersion, currentVersion))

  const handleRecheck = () => {
    startTransition(() => router.refresh())
  }

  const handleUpdate = () => {
    startTransition(async () => {
      const res = await triggerSelfUpdate()
      if (res.ok) {
        setUpdateStarted(true)
        toast.success(t.updates.updateStartedTitle, { description: t.updates.updateStartedDesc })
      } else if (res.error === 'not_configured') {
        toast.error(t.updates.updaterNotConfigured)
      } else {
        toast.error(t.updates.updateErrorTitle, { description: t.updates.updateErrorDesc })
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.updates.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.updates.subtitle}</p>
      </div>

      <div className="max-w-xl rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t.updates.currentVersionLabel}</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {currentVersion ? `v${currentVersion.replace(/^v/i, '')}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t.updates.latestVersionLabel}</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {latestVersion ? (
                <a
                  href={changelogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {`v${latestVersion.replace(/^v/i, '')}`}
                  <ExternalLink className="size-3.5" />
                </a>
              ) : (
                t.updates.checkErrorDesc
              )}
            </span>
          </div>

          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              !latestVersion
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : hasUpdate
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {!latestVersion ? (
              <span>{t.updates.checkErrorTitle}</span>
            ) : hasUpdate ? (
              <>
                <Rocket className="size-4 shrink-0" />
                <span>{t.updates.updateAvailable}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{t.updates.upToDate}</span>
              </>
            )}
          </div>

          {updateStarted ? (
            <p className="text-sm text-muted-foreground">{t.updates.updateStartedDesc}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleRecheck} disabled={isPending}>
                <RefreshCw className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                {t.updates.recheckButton}
              </Button>
              {hasUpdate && (
                <Button
                  type="button"
                  onClick={handleUpdate}
                  disabled={isPending || !updaterConfigured}
                  title={updaterConfigured ? undefined : t.updates.updaterNotConfigured}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Rocket className="size-4" />
                  )}
                  {isPending ? t.updates.updatingButton : t.updates.updateButton}
                </Button>
              )}
            </div>
          )}

          {!updaterConfigured && !updateStarted && (
            <p className="text-xs text-muted-foreground">{t.updates.updaterNotConfigured}</p>
          )}
        </div>
      </div>
    </div>
  )
}
