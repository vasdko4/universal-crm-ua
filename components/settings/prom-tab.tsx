'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StoreSettingsData } from '@/app/actions/settings-store'
import { triggerPromSync } from '@/app/actions/prom'
import type { SectionProps } from './settings-types'

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 h' },
  { value: 180, label: '3 h' },
  { value: 360, label: '6 h' },
  { value: 1440, label: '24 h' },
]

export function PromSection({ data, setData, t }: SectionProps) {
  const p = data.prom
  const set = (patch: Partial<StoreSettingsData['prom']>) =>
    setData((d) => ({ ...d, prom: { ...d.prom, ...patch } }))
  const [showToken, setShowToken] = useState(false)
  const [syncing, startSync] = useTransition()
  // Secrets are never sent back to the browser (stripSecrets), so after a
  // reload the field looks empty even though the token is stored encrypted
  // in the DB. But the toggle can only be ON with a saved token (it can't
  // be enabled while the field is empty), so `p.enabled` proves a token
  // exists server-side — the Sync button must not stay disabled because of
  // the empty-looking field.
  const tokenTyped = Boolean(p.apiToken.trim())
  const tokenConfigured = tokenTyped || p.enabled

  function syncNow() {
    startSync(async () => {
      try {
        const res = await triggerPromSync()
        if (res.ok) {
          toast.success(t.promSyncStarted)
          // Refresh the last-sync line without a full page reload: the sync
          // action returns the summary, so mirror it into local state.
          if (res.summary) set({ lastSyncAt: new Date().toISOString(), lastSyncSummary: res.summary })
        } else {
          toast.error(res.error || t.promSyncError)
        }
      } catch {
        // The full sync can outlive the proxied request (Cloudflare drops
        // it at ~100s) — the server keeps working in the background. Never
        // show the error page for this; point at the last-sync row instead.
        toast.error(t.promSyncDisconnected, { duration: 12000 })
      }
    })
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t.promTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t.promDescPrefix}{' '}
          <a
            href="https://my.prom.ua/cabinet/user/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t.promDescLink}
          </a>{' '}
          {t.promDescSuffix}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.promToggleTitle}</p>
          <p className="text-xs text-muted-foreground">
            {p.enabled ? t.promToggleOn : t.promToggleOff}
          </p>
        </div>
        <Switch
          checked={p.enabled}
          disabled={!tokenTyped && !p.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="prom-api-token">{t.promTokenLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="prom-api-token"
            name="prom-api-token"
            type={showToken ? 'text' : 'password'}
            value={p.apiToken}
            placeholder="••••••••"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            onChange={(e) => set({ apiToken: e.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={showToken ? t.hideSecretAria : t.showSecretAria}
            onClick={() => setShowToken((v) => !v)}
          >
            {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t.promTokenHint}</p>
        {p.enabled && !tokenTyped && (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            ● {t.promTokenSaved}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="prom-interval">{t.promIntervalLabel}</Label>
          <Select
            value={String(p.syncIntervalMinutes)}
            onValueChange={(v) => set({ syncIntervalMinutes: Number(v) })}
          >
            <SelectTrigger id="prom-interval" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t.promIntervalHint}</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={p.syncPrices}
            onCheckedChange={(v) => set({ syncPrices: v === true })}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">{t.promSyncPricesLabel}</span>
            <span className="block text-xs text-muted-foreground">{t.promSyncPricesHint}</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={p.syncStock}
            onCheckedChange={(v) => set({ syncStock: v === true })}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">{t.promSyncStockLabel}</span>
            <span className="block text-xs text-muted-foreground">{t.promSyncStockHint}</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={p.syncCharacteristics}
            onCheckedChange={(v) => set({ syncCharacteristics: v === true })}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">{t.promSyncCharacteristicsLabel}</span>
            <span className="block text-xs text-muted-foreground">{t.promSyncCharacteristicsHint}</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.promLastSyncLabel}
          </p>
          <p className="mt-1 truncate text-sm text-foreground">
            {p.lastSyncAt
              ? `${new Date(p.lastSyncAt).toLocaleString()}${p.lastSyncSummary ? ` — ${p.lastSyncSummary}` : ''}`
              : t.promNeverSynced}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={syncNow} disabled={syncing || !p.enabled}>
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {syncing ? t.promSyncing : t.promSyncNowButton}
        </Button>
      </div>
    </div>
  )
}
