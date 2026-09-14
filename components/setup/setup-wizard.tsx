'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { runSetup } from '@/app/actions/setup'
import { TEMPLATES, type TemplateId } from '@/lib/shop/templates'
import { getDatabaseStatus, type DatabaseStatus } from '@/app/actions/db-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useSetupLocale } from '@/lib/i18n/setup-locale'
import { fillTemplate } from '@/lib/i18n/dictionaries'
import type { SetupDictionary } from '@/lib/i18n/setup'
import { SetupLangSwitch } from '@/components/setup/setup-lang-switch'
import {
  Store,
  Palette,
  ShieldCheck,
  Truck,
  Sparkles,
  Globe,
  Database,
  Package,
  PackageOpen,
  Loader2,
  Check,
  X,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'

type StepId = 'welcome' | 'db' | 'admin' | 'store' | 'design' | 'seo' | 'finish'

const STEP_IDS: StepId[] = ['welcome', 'db', 'admin', 'store', 'design', 'seo', 'finish']

export function SetupWizard() {
  const router = useRouter()
  const { locale, t, setLocale } = useSetupLocale()
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEP_IDS[stepIndex]

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const [storeName, setStoreName] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [novaPoshtaApiKey, setNovaPoshtaApiKey] = useState('')

  const [templateId, setTemplateId] = useState<TemplateId>('classic')

  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [googleVerification, setGoogleVerification] = useState('')
  const [indexingEnabled, setIndexingEnabled] = useState(true)

  const [installDemo, setInstallDemo] = useState(true)

  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null)
  const [dbChecking, setDbChecking] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const checkDb = async () => {
    setDbChecking(true)
    try {
      setDbStatus(await getDatabaseStatus())
    } catch {
      setDbStatus({ configured: false, connected: false, schemaReady: false, error: t.db.checkFailed })
    }
    setDbChecking(false)
  }

  // Fetch DB status when the user reaches the database step. Genuine
  // data-fetching effect (checkDb flips a loading flag before its awaited
  // network call, same as React's own docs example for fetching data in an
  // effect — https://react.dev/learn/synchronizing-with-effects#fetching-data).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step === 'db' && !dbStatus) void checkDb()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const goNext = () => {
    setError(null)
    if (step === 'db') {
      if (!dbStatus?.connected || !dbStatus?.schemaReady) return setError(t.db.unreachable)
    }
    if (step === 'admin') {
      if (!name.trim()) return setError(t.admin.nameRequired)
      if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t.admin.emailInvalid)
      if (password.length < 8) return setError(t.admin.passwordShort)
      if (password !== confirm) return setError(t.admin.passwordMismatch)
    }
    if (step === 'store') {
      if (!storeName.trim()) return setError(t.store.nameRequired)
    }
    setStepIndex((i) => Math.min(i + 1, STEP_IDS.length - 1))
  }

  const goBack = () => {
    setError(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  const handleFinish = async () => {
    setError(null)
    setLoading(true)
    const res = await runSetup({
      admin: { name: name.trim(), email: email.trim().toLowerCase(), password },
      store: {
        name: storeName.trim(),
        description: storeDescription.trim(),
        novaPoshtaApiKey: novaPoshtaApiKey.trim(),
      },
      design: { templateId },
      seo: {
        metaTitle: metaTitle.trim(),
        metaDescription: metaDescription.trim(),
        googleVerification: googleVerification.trim(),
        indexingEnabled,
      },
      installDemo,
    })
    if (!res.success) {
      setLoading(false)
      setError(res.error ?? t.nav.setupFailed)
      return
    }
    // Sign the freshly created admin in and enter the admin center.
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    })
    setLoading(false)
    if (signInError) {
      // Setup succeeded; just send them to the login screen.
      router.push('/sign-in')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  const metaTitlePlaceholder = storeName
    ? fillTemplate(t.seo.metaTitleWithName, { name: storeName })
    : t.seo.metaTitleFallback

  return (
    <main translate="no" lang={locale} className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-xl">
        <SetupLangSwitch locale={locale} t={t} onChange={setLocale} />
        <Stepper current={stepIndex} t={t} />

        <Card className="mt-6 p-6 sm:p-8">
          {step === 'welcome' && (
            <StepShell icon={<Store className="size-6" />} title={t.welcome.title} subtitle={t.welcome.subtitle}>
              <ul className="mt-2 flex flex-col gap-3 text-sm text-muted-foreground">
                <FeatureRow icon={<Database className="size-4" />} text={t.welcome.featureDb} />
                <FeatureRow icon={<ShieldCheck className="size-4" />} text={t.welcome.featureAdmin} />
                <FeatureRow icon={<Store className="size-4" />} text={t.welcome.featureStore} />
                <FeatureRow icon={<Truck className="size-4" />} text={t.welcome.featureDelivery} />
                <FeatureRow icon={<Globe className="size-4" />} text={t.welcome.featureSeo} />
                <FeatureRow icon={<Sparkles className="size-4" />} text={t.welcome.featureDemo} />
              </ul>
            </StepShell>
          )}

          {step === 'db' && (
            <StepShell icon={<Database className="size-6" />} title={t.db.title} subtitle={t.db.subtitle}>
              <div className="mt-2 flex flex-col gap-3">
                {dbChecking || !dbStatus ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {t.db.checking}
                  </div>
                ) : (
                  <>
                    <DbCheckRow ok={dbStatus.configured} label={t.db.paramsOk} hint={t.db.paramsHint} />
                    <DbCheckRow
                      ok={dbStatus.connected}
                      label={t.db.connected}
                      hint={dbStatus.connected ? t.db.connectedHint : dbStatus.error || t.db.noReply}
                    />
                    <DbCheckRow
                      ok={dbStatus.schemaReady}
                      label={t.db.schema}
                      hint={dbStatus.schemaReady ? t.db.schemaReady : t.db.schemaPending}
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={checkDb} disabled={dbChecking}>
                        <RefreshCw className="size-4" />
                        {t.db.recheck}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </StepShell>
          )}

          {step === 'admin' && (
            <StepShell icon={<ShieldCheck className="size-6" />} title={t.admin.title} subtitle={t.admin.subtitle}>
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-name">{t.admin.name}</Label>
                  <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-email">Email</Label>
                  <Input
                    id="s-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="s-password">{t.admin.password}</Label>
                    <Input
                      id="s-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder={t.admin.passwordPlaceholder}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="s-confirm">{t.admin.confirm}</Label>
                    <Input
                      id="s-confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {step === 'store' && (
            <StepShell icon={<Store className="size-6" />} title={t.store.title} subtitle={t.store.subtitle}>
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-store">{t.store.name}</Label>
                  <Input
                    id="s-store"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder={t.store.namePlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-desc">{t.store.description}</Label>
                  <Textarea
                    id="s-desc"
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    rows={2}
                    placeholder={t.store.descriptionPlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-np">{t.store.npKey}</Label>
                  <Input
                    id="s-np"
                    value={novaPoshtaApiKey}
                    onChange={(e) => setNovaPoshtaApiKey(e.target.value)}
                    placeholder={t.store.npPlaceholder}
                  />
                  <p className="text-xs text-muted-foreground">{t.store.npHint}</p>
                </div>
              </div>
            </StepShell>
          )}

          {step === 'design' && (
            <StepShell icon={<Palette className="size-6" />} title={t.design.title} subtitle={t.design.subtitle}>
              <div className="mt-2 grid max-h-[50svh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                {TEMPLATES.map((tmpl) => {
                  const active = templateId === tmpl.id
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTemplateId(tmpl.id)}
                      className={
                        'relative flex flex-col gap-2 rounded-xl border-2 p-2 text-left transition-colors ' +
                        (active ? 'border-primary' : 'border-border hover:border-primary/40')
                      }
                    >
                      {active && (
                        <span className="absolute right-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                      <div
                        className="flex flex-col gap-1.5 p-2"
                        style={{ backgroundColor: tmpl.swatches.bg, borderRadius: tmpl.radius }}
                      >
                        <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: tmpl.swatches.primary }} />
                        <div className="grid grid-cols-2 gap-1.5">
                          {[0, 1].map((i) => (
                            <div
                              key={i}
                              className="flex flex-col gap-1 p-1.5"
                              style={{ backgroundColor: tmpl.swatches.card, borderRadius: tmpl.radius }}
                            >
                              <span className="h-1 w-full rounded-full" style={{ backgroundColor: tmpl.swatches.accent }} />
                              <span className="h-1 w-2/3 rounded-full" style={{ backgroundColor: tmpl.swatches.primary }} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-foreground">{tmpl.name}</span>
                    </button>
                  )
                })}
              </div>
            </StepShell>
          )}

          {step === 'seo' && (
            <StepShell icon={<Globe className="size-6" />} title={t.seo.title} subtitle={t.seo.subtitle}>
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-mtitle">{t.seo.metaTitle}</Label>
                  <Input
                    id="s-mtitle"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder={metaTitlePlaceholder}
                    maxLength={70}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-mdesc">{t.seo.metaDescription}</Label>
                  <Textarea
                    id="s-mdesc"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={2}
                    maxLength={170}
                    placeholder={t.seo.metaDescriptionPlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-gsc">{t.seo.gsc}</Label>
                  <Input
                    id="s-gsc"
                    value={googleVerification}
                    onChange={(e) => setGoogleVerification(e.target.value)}
                    placeholder={t.seo.gscPlaceholder}
                  />
                </div>
                <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.seo.indexing}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.seo.indexingHint}</p>
                  </div>
                  <Switch checked={indexingEnabled} onCheckedChange={setIndexingEnabled} />
                </label>
              </div>
            </StepShell>
          )}

          {step === 'finish' && (
            <StepShell icon={<Sparkles className="size-6" />} title={t.finish.title} subtitle={t.finish.subtitle}>
              <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t.finish.variantAria}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={installDemo}
                  onClick={() => setInstallDemo(true)}
                  className={
                    'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ' +
                    (installDemo
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/50')
                  }
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted text-foreground">
                    <PackageOpen className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{t.finish.demoTitle}</span>
                  <span className="text-xs text-muted-foreground">{t.finish.demoHint}</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!installDemo}
                  onClick={() => setInstallDemo(false)}
                  className={
                    'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors ' +
                    (!installDemo
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:bg-muted/50')
                  }
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-muted text-foreground">
                    <Package className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{t.finish.cleanTitle}</span>
                  <span className="text-xs text-muted-foreground">{t.finish.cleanHint}</span>
                </button>
              </div>

              <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm">
                <p className="font-medium text-foreground">{t.finish.review}</p>
                <dl className="mt-2 flex flex-col gap-1 text-muted-foreground">
                  <Row label={t.finish.rowAdmin} value={`${name} (${email})`} />
                  <Row label={t.finish.rowStore} value={storeName} />
                  <Row label={t.finish.rowDesign} value={TEMPLATES.find((tmpl) => tmpl.id === templateId)?.name ?? templateId} />
                  <Row label={t.finish.rowDomain} value={t.finish.domainAuto} />
                  <Row
                    label={t.finish.rowIndexing}
                    value={indexingEnabled ? t.finish.indexingOn : t.finish.indexingOff}
                  />
                  <Row label={t.finish.rowNp} value={novaPoshtaApiKey ? t.finish.npSet : t.finish.npUnset} />
                  <Row
                    label={t.finish.rowVariant}
                    value={installDemo ? t.finish.variantDemo : t.finish.variantClean}
                  />
                </dl>
              </div>
            </StepShell>
          )}

          {error && (
            <p className="mt-5 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            {stepIndex > 0 ? (
              <Button variant="ghost" onClick={goBack} disabled={loading}>
                <ArrowLeft className="size-4" />
                {t.nav.back}
              </Button>
            ) : (
              <span />
            )}

            {step !== 'finish' ? (
              <Button onClick={goNext}>
                {stepIndex === 0 ? t.nav.start : t.nav.next}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {t.nav.complete}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  )
}

function Stepper({ current, t }: { current: number; t: SetupDictionary }) {
  return (
    <ol className="flex items-center gap-2">
      {STEP_IDS.map((id, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={id} className="flex flex-1 flex-col gap-2">
            <div
              className={
                'h-1.5 rounded-full transition-colors ' + (done || active ? 'bg-primary' : 'bg-border')
              }
            />
            <span className={'text-xs font-medium ' + (active ? 'text-foreground' : 'text-muted-foreground')}>
              {t.steps[id]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function StepShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        {icon}
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground text-balance">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>
      {children}
    </div>
  )
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground">{icon}</span>
      {text}
    </li>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{label}</dt>
      <dd className="truncate font-medium text-foreground">{value || '—'}</dd>
    </div>
  )
}

function DbCheckRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-4">
      <span
        className={
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ' +
          (ok ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive')
        }
      >
        {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}
