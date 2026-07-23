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

const STEPS: { id: StepId; label: string }[] = [
  { id: 'welcome', label: 'Начало' },
  { id: 'db', label: 'База данных' },
  { id: 'admin', label: 'Администратор' },
  { id: 'store', label: 'Магазин' },
  { id: 'design', label: 'Дизайн' },
  { id: 'seo', label: 'SEO' },
  { id: 'finish', label: 'Готово' },
]

export function SetupWizard() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex].id

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
      setDbStatus({ configured: false, connected: false, schemaReady: false, error: 'Не удалось проверить подключение' })
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
      if (!dbStatus?.connected || !dbStatus?.schemaReady)
        return setError('База данных недоступна. Проверьте подключение, прежде чем продолжить.')
    }
    if (step === 'admin') {
      if (!name.trim()) return setError('Укажите имя администратора')
      if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Укажите корректный email')
      if (password.length < 8) return setError('Пароль должен быть не короче 8 символов')
      if (password !== confirm) return setError('Пароли не совпадают')
    }
    if (step === 'store') {
      if (!storeName.trim()) return setError('Укажите название магазина')
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
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
      setError(res.error ?? 'Не удалось выполнить установку')
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

  return (
    <main translate="no" className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-xl">
        <Stepper current={stepIndex} />

        <Card className="mt-6 p-6 sm:p-8">
          {step === 'welcome' && (
            <StepShell
              icon={<Store className="size-6" />}
              title="Установка магазина"
              subtitle="Мастер поможет создать администратора и выполнить базовую настройку. Это займёт меньше минуты."
            >
              <ul className="mt-2 flex flex-col gap-3 text-sm text-muted-foreground">
                <FeatureRow icon={<Database className="size-4" />} text="Проверка подключения к базе данных" />
                <FeatureRow icon={<ShieldCheck className="size-4" />} text="Учётная запись администратора" />
                <FeatureRow icon={<Store className="size-4" />} text="Название и описание магазина" />
                <FeatureRow icon={<Truck className="size-4" />} text="Доставка и оплата (Нова Пошта и др.)" />
                <FeatureRow icon={<Globe className="size-4" />} text="Домен и SEO для Google" />
                <FeatureRow icon={<Sparkles className="size-4" />} text="Чистая версия или демо-данные" />
              </ul>
            </StepShell>
          )}

          {step === 'db' && (
            <StepShell
              icon={<Database className="size-6" />}
              title="База данных"
              subtitle="Проверка подключения к PostgreSQL. Скрипт работает на любом хостинге — подключение задаётся переменной DATABASE_URL или на экране настройки БД."
            >
              <div className="mt-2 flex flex-col gap-3">
                {dbChecking || !dbStatus ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Проверяем подключение к базе данных…
                  </div>
                ) : (
                  <>
                    <DbCheckRow ok={dbStatus.configured} label="Параметры подключения заданы" hint="DATABASE_URL найден в окружении" />
                    <DbCheckRow ok={dbStatus.connected} label="Подключение к базе данных" hint={dbStatus.connected ? 'Сервер PostgreSQL отвечает' : dbStatus.error || 'Нет ответа от сервера'} />
                    <DbCheckRow ok={dbStatus.schemaReady} label="Схема базы данных" hint={dbStatus.schemaReady ? 'Все таблицы созданы' : 'Таблицы будут созданы автоматически'} />
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={checkDb} disabled={dbChecking}>
                        <RefreshCw className="size-4" />
                        Проверить снова
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </StepShell>
          )}

          {step === 'admin' && (
            <StepShell
              icon={<ShieldCheck className="size-6" />}
              title="Администратор"
              subtitle="Создайте учётную запись с полным доступом к админ-центру."
            >
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-name">Имя</Label>
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
                    <Label htmlFor="s-password">Пароль</Label>
                    <Input
                      id="s-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Минимум 8 символов"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="s-confirm">Повтор пароля</Label>
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
            <StepShell
              icon={<Store className="size-6" />}
              title="Магазин"
              subtitle="Основные данные магазина. Всё можно изменить позже в настройках."
            >
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-store">Название магазина</Label>
                  <Input
                    id="s-store"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Например, Techno Store"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-desc">Описание</Label>
                  <Textarea
                    id="s-desc"
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    rows={2}
                    placeholder="Короткое описание магазина"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-np">API-ключ Нова Пошта (необязательно)</Label>
                  <Input
                    id="s-np"
                    value={novaPoshtaApiKey}
                    onChange={(e) => setNovaPoshtaApiKey(e.target.value)}
                    placeholder="Для поиска городов и отделений"
                  />
                  <p className="text-xs text-muted-foreground">
                    Нужен для выбора отделений при оформлении. Можно добавить позже в разделе «Доставка».
                  </p>
                </div>
              </div>
            </StepShell>
          )}

          {step === 'design' && (
            <StepShell
              icon={<Palette className="size-6" />}
              title="Дизайн магазина"
              subtitle="Выберите оформление витрины. Его можно сменить в любой момент в настройках."
            >
              <div className="mt-2 grid max-h-[50svh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                {TEMPLATES.map((t) => {
                  const active = templateId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTemplateId(t.id)}
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
                        style={{ backgroundColor: t.swatches.bg, borderRadius: t.radius }}
                      >
                        <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: t.swatches.primary }} />
                        <div className="grid grid-cols-2 gap-1.5">
                          {[0, 1].map((i) => (
                            <div
                              key={i}
                              className="flex flex-col gap-1 p-1.5"
                              style={{ backgroundColor: t.swatches.card, borderRadius: t.radius }}
                            >
                              <span className="h-1 w-full rounded-full" style={{ backgroundColor: t.swatches.accent }} />
                              <span className="h-1 w-2/3 rounded-full" style={{ backgroundColor: t.swatches.primary }} />
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-foreground">{t.name}</span>
                    </button>
                  )
                })}
              </div>
            </StepShell>
          )}

          {step === 'seo' && (
            <StepShell
              icon={<Globe className="size-6" />}
              title="SEO для Google"
              subtitle="Данные для поисковых систем. Домен определится автоматически по адресу сайта. Всё можно изменить позже в настройках."
            >
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-mtitle">Заголовок для Google (meta title)</Label>
                  <Input
                    id="s-mtitle"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder={storeName ? `${storeName} — интернет-магазин` : 'Мой магазин — интернет-магазин'}
                    maxLength={70}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-mdesc">Описание для Google (meta description)</Label>
                  <Textarea
                    id="s-mdesc"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    rows={2}
                    maxLength={170}
                    placeholder="Короткое описание, которое увидят в результатах поиска"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="s-gsc">Код подтверждения Google Search Console (необязательно)</Label>
                  <Input
                    id="s-gsc"
                    value={googleVerification}
                    onChange={(e) => setGoogleVerification(e.target.value)}
                    placeholder="Содержимое meta-тега google-site-verification"
                  />
                </div>
                <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Разрешить индексацию в Google</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Отключите, если сайт ещё не готов к запуску — он будет скрыт из поиска (noindex),
                      пока вы не включите индексацию в настройках.
                    </p>
                  </div>
                  <Switch checked={indexingEnabled} onCheckedChange={setIndexingEnabled} />
                </label>
              </div>
            </StepShell>
          )}

          {step === 'finish' && (
            <StepShell
              icon={<Sparkles className="size-6" />}
              title="Почти готово"
              subtitle="Выберите, с чего начать, и завершите установку."
            >
              <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Вариант установки">
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
                  <span className="text-sm font-medium text-foreground">Демо-версия</span>
                  <span className="text-xs text-muted-foreground">
                    С примерами товаров, категорий и заказов — сразу видно витрину в работе.
                  </span>
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
                  <span className="text-sm font-medium text-foreground">Чистая версия</span>
                  <span className="text-xs text-muted-foreground">
                    Пустой магазин без демо-данных — для запуска с собственным каталогом.
                  </span>
                </button>
              </div>

              <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm">
                <p className="font-medium text-foreground">Проверьте данные</p>
                <dl className="mt-2 flex flex-col gap-1 text-muted-foreground">
                  <Row label="Администратор" value={`${name} (${email})`} />
                  <Row label="Магазин" value={storeName} />
                  <Row label="Дизайн" value={TEMPLATES.find((t) => t.id === templateId)?.name ?? templateId} />
                  <Row label="Домен" value="определится автоматически" />
                  <Row label="Индексация Google" value={indexingEnabled ? 'включена' : 'выключена'} />
                  <Row label="Нова Пошта" value={novaPoshtaApiKey ? 'ключ указан' : 'не указан'} />
                  <Row label="Вариант установки" value={installDemo ? 'демо-версия' : 'чистая версия'} />
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
                Назад
              </Button>
            ) : (
              <span />
            )}

            {step !== 'finish' ? (
              <Button onClick={goNext}>
                {stepIndex === 0 ? 'Начать' : 'Далее'}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Завершить установку
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  )
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s.id} className="flex flex-1 flex-col gap-2">
            <div
              className={
                'h-1.5 rounded-full transition-colors ' +
                (done || active ? 'bg-primary' : 'bg-border')
              }
            />
            <span
              className={
                'text-xs font-medium ' + (active ? 'text-foreground' : 'text-muted-foreground')
              }
            >
              {s.label}
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
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground text-balance">
        {title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground text-pretty">{subtitle}</p>
      {children}
    </div>
  )
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-7 items-center justify-center rounded-md bg-muted text-foreground">
        {icon}
      </span>
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
