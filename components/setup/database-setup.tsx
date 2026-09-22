'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveDatabaseConfig, getDatabaseStatus } from '@/app/actions/db-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Database, Loader2, Check, RefreshCw, TerminalSquare } from 'lucide-react'
import { useSetupLocale } from '@/lib/i18n/setup-locale'
import { SetupLangSwitch } from '@/components/setup/setup-lang-switch'

export function DatabaseSetup() {
  const router = useRouter()
  const { locale, t, setLocale } = useSetupLocale()
  const d = t.database

  const [mode, setMode] = useState<'fields' | 'url'>('fields')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('5432')
  const [database, setDatabase] = useState('')
  const [user, setUser] = useState('postgres')
  const [password, setPassword] = useState('')
  const [ssl, setSsl] = useState(false)
  const [url, setUrl] = useState('')
  const [setupToken, setSetupToken] = useState('')

  useEffect(() => {
    document.title = t.pageTitle
  }, [t.pageTitle])

  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('token') ?? ''
      const fromStore = sessionStorage.getItem('setup-token') ?? ''
      if (fromUrl) {
        setSetupToken(fromUrl)
        sessionStorage.setItem('setup-token', fromUrl)
      } else if (fromStore) {
        setSetupToken(fromStore)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    setNotice(null)
    setSaving(true)
    const res = await saveDatabaseConfig(
      mode === 'url'
        ? { mode: 'url', url, setupToken }
        : { mode: 'fields', host, port, database, user, password, ssl, setupToken },
    )
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? d.saveFailed)
      return
    }
    setSaved(true)
    setNotice(res.schemaApplied ? d.savedSchema : d.savedExists)
  }

  const handleRecheck = async () => {
    setError(null)
    setChecking(true)
    const status = await getDatabaseStatus()
    setChecking(false)
    if (status.connected && status.schemaReady) {
      router.refresh()
      return
    }
    setError(d.stillOld)
  }

  return (
    <main translate="no" lang={locale} className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-xl">
        <SetupLangSwitch locale={locale} t={t} onChange={setLocale} />
        <Card className="p-6 sm:p-8">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Database className="size-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground text-balance">{d.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {d.subtitleBefore}
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>
            {d.subtitleAfter}
          </p>

          {!saved ? (
            <>
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-border p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setMode('fields')}
                  className={
                    'flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ' +
                    (mode === 'fields'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground')
                  }
                >
                  {d.byFields}
                </button>
                <button
                  type="button"
                  onClick={() => setMode('url')}
                  className={
                    'flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ' +
                    (mode === 'url'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground')
                  }
                >
                  {d.byUrl}
                </button>
              </div>

              {mode === 'fields' ? (
                <div className="mt-4 flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <Label htmlFor="db-host">{d.host}</Label>
                      <Input id="db-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="db-port">{d.port}</Label>
                      <Input
                        id="db-port"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder="5432"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="db-name">{d.database}</Label>
                    <Input
                      id="db-name"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      placeholder="magazine"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="db-user">{d.user}</Label>
                      <Input
                        id="db-user"
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        placeholder="postgres"
                        autoComplete="off"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="db-pass">{d.password}</Label>
                      <Input
                        id="db-pass"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{d.ssl}</p>
                      <p className="text-xs text-muted-foreground">{d.sslHint}</p>
                    </div>
                    <Switch checked={ssl} onCheckedChange={setSsl} />
                  </label>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  <Label htmlFor="db-url">{d.url}</Label>
                  <Input
                    id="db-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="postgresql://user:password@localhost:5432/magazine"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">{d.urlFormat}</p>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2">
                <Label htmlFor="setup-token">{t.errors.setupTokenRequired.split('.')[0]}</Label>
                <Input
                  id="setup-token"
                  value={setupToken}
                  onChange={(e) => {
                    setSetupToken(e.target.value)
                    try {
                      sessionStorage.setItem('setup-token', e.target.value)
                    } catch {
                      /* ignore */
                    }
                  }}
                  placeholder="SETUP_TOKEN"
                  autoComplete="off"
                />
              </div>

              {error && (
                <p className="mt-5 text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {d.save}
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-6 flex flex-col gap-4">
              {notice && (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-foreground">{notice}</span>
                </div>
              )}
              <div className="rounded-lg border border-border p-4 text-sm">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <TerminalSquare className="size-4" />
                  {d.restartTitle}
                </p>
                <p className="mt-2 text-muted-foreground">{d.restartBody}</p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
                  pnpm dev
                </pre>
                <p className="mt-2 text-muted-foreground">{d.restartThen}</p>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => setSaved(false)} disabled={checking}>
                  {d.change}
                </Button>
                <Button onClick={handleRecheck} disabled={checking}>
                  {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {d.check}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}
