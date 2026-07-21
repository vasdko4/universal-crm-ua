'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Store,
  Share2,
  Mail,
  BarChart3,
  ImageIcon,
  Loader2,
  Save,
  Palette,
  Check,
  Globe,
  Phone,
  Plus,
  Trash2,
  Clock,
  MapPin,
  MessageCircle,
  Power,
  Search,
  Bell,
  Send,
  Upload,
  X,
  KeyRound,
  Eye,
  EyeOff,
  LayoutTemplate,
} from 'lucide-react'
import { TEMPLATES } from '@/lib/shop/templates'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  clearSiteCache,
  updateStoreSettings,
  type HomeHeroLocaleContent,
  type StoreSettingsData,
  type WeekDay,
  type WidgetChannelKey,
} from '@/app/actions/settings-store'

type Section =
  | 'general'
  | 'homepage'
  | 'seo'
  | 'design'
  | 'branding'
  | 'contacts'
  | 'widget'
  | 'social'
  | 'email'
  | 'notifications'
  | 'ads'
  | 'googleAuth'
  | 'system'

const SECTIONS: { key: Section; label: string; icon: typeof Store }[] = [
  { key: 'general', label: 'Основные', icon: Store },
  { key: 'homepage', label: 'Главная страница', icon: LayoutTemplate },
  { key: 'seo', label: 'SEO', icon: Search },
  { key: 'design', label: 'Дизайн', icon: Palette },
  { key: 'branding', label: 'Логотип', icon: ImageIcon },
  { key: 'contacts', label: 'Контакты', icon: Phone },
  { key: 'widget', label: 'Кнопка связи', icon: MessageCircle },
  { key: 'social', label: 'Соцсети', icon: Share2 },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'notifications', label: 'Уведомления', icon: Bell },
  { key: 'ads', label: 'Google Ads / Analytics', icon: BarChart3 },
  { key: 'googleAuth', label: 'Вход через Google', icon: KeyRound },
  { key: 'system', label: 'Система', icon: Power },
]

const WEEK_DAYS: { key: WeekDay; label: string }[] = [
  { key: 'mon', label: 'Понедельник' },
  { key: 'tue', label: 'Вторник' },
  { key: 'wed', label: 'Среда' },
  { key: 'thu', label: 'Четверг' },
  { key: 'fri', label: 'Пятница' },
  { key: 'sat', label: 'Суббота' },
  { key: 'sun', label: 'Воскресенье' },
]

export function SettingsManager({ initial }: { initial: StoreSettingsData }) {
  const [data, setData] = useState<StoreSettingsData>(initial)
  const [section, setSection] = useState<Section>('general')
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await updateStoreSettings(data)
      if (res.success) toast.success('Настройки сохранены')
      else toast.error('Ошибка сохранения')
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Настройки</h1>
          <p className="text-sm text-muted-foreground">Конфигурация магазина и интеграций</p>
        </div>
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Сохранить
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                section === s.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <s.icon className="size-4" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="rounded-xl border border-border bg-card p-6">
          {section === 'general' && <GeneralSection data={data} setData={setData} />}
          {section === 'homepage' && <HomepageSection data={data} setData={setData} />}
          {section === 'seo' && <SeoSection data={data} setData={setData} />}
          {section === 'design' && <DesignSection data={data} setData={setData} />}
          {section === 'branding' && <BrandingSection data={data} setData={setData} />}
          {section === 'contacts' && <ContactsSection data={data} setData={setData} />}
          {section === 'widget' && <WidgetSection data={data} setData={setData} />}
          {section === 'social' && <SocialSection data={data} setData={setData} />}
          {section === 'email' && <EmailSection data={data} setData={setData} />}
          {section === 'notifications' && <NotificationsSection data={data} setData={setData} />}
          {section === 'ads' && <AdsSection data={data} setData={setData} />}
          {section === 'googleAuth' && <GoogleAuthSection data={data} setData={setData} />}
          {section === 'system' && <SystemSection />}
        </div>
      </div>
    </div>
  )
}

type SectionProps = {
  data: StoreSettingsData
  setData: React.Dispatch<React.SetStateAction<StoreSettingsData>>
}

function SystemSection() {
  const [clearing, startClearing] = useTransition()

  function handleClearCache() {
    startClearing(async () => {
      try {
        await clearSiteCache()
        toast.success('Кеш очищен — витрина обновится при следующем открытии страниц')
      } catch {
        toast.error('Не удалось очистить кеш')
      }
    })
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Кеш сайта</h2>
        <p className="text-sm text-muted-foreground">
          Витрина кеширует каталог, страницы товаров, настройки и отзывы, чтобы работать быстро.
          Если после изменений (импорт товаров, правки напрямую в базе) на сайте видны старые
          данные — очистите кеш вручную.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Очистить кеш</p>
          <p className="text-xs text-muted-foreground">
            Сбрасывает кеш каталога, товаров, категорий, отзывов и настроек
          </p>
        </div>
        <Button variant="outline" onClick={handleClearCache} disabled={clearing}>
          {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Очистить кеш
        </Button>
      </div>
    </div>
  )
}

function GeneralSection({ data, setData }: SectionProps) {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-name">Название магазина</Label>
        <Input
          id="s-name"
          value={data.storeName}
          onChange={(e) => setData((d) => ({ ...d, storeName: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-desc">Описание</Label>
        <Textarea
          id="s-desc"
          rows={3}
          value={data.storeDescription ?? ''}
          onChange={(e) => setData((d) => ({ ...d, storeDescription: e.target.value }))}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Открывать корзину после добавления</p>
          <p className="text-xs text-muted-foreground">
            Автоматически показывать корзину при добавлении товара
          </p>
        </div>
        <Switch
          checked={data.openCartAfterAdd}
          onCheckedChange={(v) => setData((d) => ({ ...d, openCartAfterAdd: v }))}
        />
      </div>
    </div>
  )
}

// Hero-блок главной страницы: бейдж, заголовок, описание, текст кнопки для
// каждого языка + картинка. Пустое поле = встроенный текст по умолчанию.
function HomepageSection({ data, setData }: SectionProps) {
  const [heroLocale, setHeroLocale] = useState<'uk' | 'ru'>('uk')

  function setHero(field: keyof HomeHeroLocaleContent, value: string) {
    setData((d) => ({
      ...d,
      homeHero: {
        ...d.homeHero,
        [heroLocale]: { ...d.homeHero[heroLocale], [field]: value },
      },
    }))
  }

  const hero = data.homeHero[heroLocale]
  const ph =
    heroLocale === 'uk'
      ? {
          badge: 'Преміум електроніка',
          title: 'Техніка, яка працює на вас',
          text: 'Смартфони, навушники, аудіо та аксесуари від перевірених брендів…',
          buttonText: 'Перейти до каталогу',
        }
      : {
          badge: 'Премиум электроника',
          title: 'Техника, которая работает на вас',
          text: 'Смартфоны, наушники, аудио и аксессуары от проверенных брендов…',
          buttonText: 'Перейти в каталог',
        }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Hero-блок главной страницы</h2>
        <p className="text-sm text-muted-foreground">
          Большой баннер вверху главной страницы: бейдж, заголовок, описание, кнопка и картинка.
          Пустые поля показывают стандартный текст. Тексты задаются отдельно для каждого языка.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(['uk', 'ru'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setHeroLocale(l)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              heroLocale === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {l === 'uk' ? 'Українська' : 'Русский'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-badge">Бейдж</Label>
        <p className="text-xs text-muted-foreground">Маленькая надпись над заголовком.</p>
        <Input id="hero-badge" value={hero.badge} onChange={(e) => setHero('badge', e.target.value)} placeholder={ph.badge} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-title">Заголовок</Label>
        <Input id="hero-title" value={hero.title} onChange={(e) => setHero('title', e.target.value)} placeholder={ph.title} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-text">Описание</Label>
        <Textarea id="hero-text" rows={3} value={hero.text} onChange={(e) => setHero('text', e.target.value)} placeholder={ph.text} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-btn">Текст кнопки</Label>
        <p className="text-xs text-muted-foreground">Кнопка всегда ведёт в каталог.</p>
        <Input id="hero-btn" value={hero.buttonText} onChange={(e) => setHero('buttonText', e.target.value)} placeholder={ph.buttonText} />
      </div>

      <ImageField
        label="Картинка hero-блока"
        hint="Загрузите изображение с устройства или вставьте ссылку. Пусто — стандартная картинка. Общая для обоих языков, рекомендуемое соотношение 4:3."
        value={data.homeHero.imageUrl || null}
        onChange={(v) => setData((d) => ({ ...d, homeHero: { ...d.homeHero, imageUrl: v } }))}
      />
    </div>
  )
}

function SeoSection({ data, setData }: SectionProps) {
  const seo = data.seo
  const setSeo = (patch: Partial<StoreSettingsData['seo']>) =>
    setData((d) => ({ ...d, seo: { ...d.seo, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-domain">Домен магазина</Label>
        <Input
          id="seo-domain"
          value={seo.siteUrl}
          placeholder="https://mystore.com"
          inputMode="url"
          onChange={(e) => setSeo({ siteUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Канонический адрес сайта. Используется в sitemap.xml, robots.txt, канонических ссылках и
          Open Graph. Если пусто — определяется автоматически по хостингу.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-title">Meta title</Label>
        <Input
          id="seo-title"
          value={seo.metaTitle}
          maxLength={70}
          placeholder={`${data.storeName || 'Мой магазин'} — интернет-магазин`}
          onChange={(e) => setSeo({ metaTitle: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{seo.metaTitle.length}/70 символов</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-desc">Meta description</Label>
        <Textarea
          id="seo-desc"
          rows={3}
          maxLength={170}
          value={seo.metaDescription}
          placeholder="Описание магазина для результатов поиска Google"
          onChange={(e) => setSeo({ metaDescription: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{seo.metaDescription.length}/170 символов</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-keywords">Ключевые слова</Label>
        <Input
          id="seo-keywords"
          value={seo.keywords}
          placeholder="электроника, смартфоны, наушники"
          onChange={(e) => setSeo({ keywords: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Через запятую.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-gsc">Google Search Console</Label>
        <Input
          id="seo-gsc"
          value={seo.googleVerification}
          placeholder="Код подтверждения (google-site-verification)"
          onChange={(e) => setSeo({ googleVerification: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Значение content из meta-тега подтверждения владения сайтом.
        </p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Индексация в поисковых системах</p>
          <p className="text-xs text-muted-foreground">
            Выключите, чтобы скрыть сайт из Google (noindex) до запуска
          </p>
        </div>
        <Switch
          checked={seo.indexingEnabled}
          onCheckedChange={(v) => setSeo({ indexingEnabled: v })}
        />
      </div>
    </div>
  )
}

function DesignSection({ data, setData }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Шаблон витрины</h2>
          <p className="text-sm text-muted-foreground">
            Выберите оформление магазина. Изменения применяются ко всей витрине после сохранения.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => {
            const active = data.activeTemplate === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setData((d) => ({ ...d, activeTemplate: t.id }))}
                aria-pressed={active}
                className={cn(
                  'group relative flex flex-col gap-3 overflow-hidden rounded-xl border-2 p-3 text-left transition-colors',
                  active ? 'border-primary' : 'border-border hover:border-primary/40',
                )}
              >
                {active && (
                  <span className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                )}
                {t.premium && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                    Преміум
                  </span>
                )}
                {/* Mini storefront preview */}
                <div
                  className="flex flex-col gap-2 rounded-lg p-3"
                  style={{ backgroundColor: t.swatches.bg, borderRadius: t.radius }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="h-2 w-14 rounded-full"
                      style={{ backgroundColor: t.swatches.primary }}
                    />
                    <span
                      className="h-2 w-6 rounded-full"
                      style={{ backgroundColor: t.swatches.accent }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-1.5 p-2"
                        style={{
                          backgroundColor: t.swatches.card,
                          borderRadius: `calc(${t.radius} * 0.6)`,
                        }}
                      >
                        <span
                          className="h-6 w-full"
                          style={{
                            backgroundColor: t.swatches.accent,
                            borderRadius: `calc(${t.radius} * 0.4)`,
                          }}
                        />
                        <span
                          className="h-1.5 w-3/4 rounded-full"
                          style={{ backgroundColor: t.swatches.primary, opacity: 0.7 }}
                        />
                        <span
                          className="h-4 w-full"
                          style={{
                            backgroundColor: t.swatches.primary,
                            borderRadius: `calc(${t.radius} * 0.4)`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex max-w-xl flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Язык по умолчанию</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Язык, предлагаемый новым посетителям при первом входе.
        </p>
        <Select
          value={data.defaultLocale}
          onValueChange={(v) => setData((d) => ({ ...d, defaultLocale: v }))}
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uk">Українська</SelectItem>
            <SelectItem value="ru">Русский</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function ImageField({
  label,
  hint,
  value,
  onChange,
  size = 96,
}: {
  label: string
  hint: string
  value: string | null
  onChange: (v: string) => void
  size?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Ошибка загрузки')
      onChange(data.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label={value ? `Заменить: ${label}` : `Загрузить: ${label}`}
          className="group relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted transition-colors hover:border-primary disabled:opacity-60"
          style={{ width: size, height: size }}
        >
          {value ? (
            <Image
              src={value || '/placeholder.svg'}
              alt={label}
              width={size}
              height={size}
              className="h-full w-full object-contain"
              unoptimized
            />
          ) : uploading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
          )}
          {value && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Loader2 className="size-5 animate-spin text-foreground" />
              ) : (
                <Upload className="size-5 text-foreground" />
              )}
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {value ? 'Заменить' : 'Выбрать файл'}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onChange('')}
              >
                <X className="size-3.5" />
                Удалить
              </Button>
            )}
          </div>
          <Input
            value={value ?? ''}
            placeholder="или вставьте ссылку https://..."
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

function BrandingSection({ data, setData }: SectionProps) {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <ImageField
        label="Логотип"
        hint="Загрузите изображение с устройства или вставьте ссылку. Отображается в шапке админ-центра и магазина."
        value={data.logoUrl}
        onChange={(v) => setData((d) => ({ ...d, logoUrl: v }))}
      />
      <ImageField
        label="Favicon"
        hint="Иконка сайта (32×32). Загрузите файл или вставьте ссылку."
        value={data.faviconUrl}
        onChange={(v) => setData((d) => ({ ...d, faviconUrl: v }))}
        size={48}
      />
    </div>
  )
}

function ContactsSection({ data, setData }: SectionProps) {
  const c = data.contact
  const setContact = (patch: Partial<StoreSettingsData['contact']>) =>
    setData((d) => ({ ...d, contact: { ...d.contact, ...patch } }))

  const phones = c.phones.length ? c.phones : ['']

  const updatePhone = (i: number, value: string) =>
    setContact({ phones: phones.map((p, idx) => (idx === i ? value : p)) })
  const addPhone = () => {
    if (phones.length >= 3) return
    setContact({ phones: [...phones, ''] })
  }
  const removePhone = (i: number) =>
    setContact({ phones: phones.filter((_, idx) => idx !== i) })

  const updateDay = (day: WeekDay, patch: Partial<StoreSettingsData['contact']['workingHours'][WeekDay]>) =>
    setContact({
      workingHours: { ...c.workingHours, [day]: { ...c.workingHours[day], ...patch } },
    })

  return (
    <div className="flex max-w-xl flex-col gap-8">
      {/* Phones */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Телефоны</h2>
        </div>
        <p className="text-sm text-muted-foreground">Можно добавить до 3 номеров. Отображаются в футере магазина.</p>
        {phones.map((phone, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="tel"
              value={phone}
              placeholder="+380 00 000 00 00"
              onChange={(e) => updatePhone(i, e.target.value)}
            />
            {phones.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removePhone(i)}
                aria-label="Удалить номер"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {phones.length < 3 && (
          <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={addPhone}>
            <Plus className="size-4" /> Добавить номер
          </Button>
        )}
      </div>

      {/* Address */}
      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <Label htmlFor="c-address" className="text-base font-semibold">
            Адрес магазина
            <span className="ml-2 text-xs font-normal text-muted-foreground">(необязательно)</span>
          </Label>
        </div>
        <Textarea
          id="c-address"
          rows={2}
          value={c.address}
          placeholder="г. Киев, ул. Крещатик, 1"
          onChange={(e) => setContact({ address: e.target.value })}
        />
      </div>

      {/* Working hours */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Время работы</h2>
        </div>
        <div className="flex flex-col gap-2">
          {WEEK_DAYS.map(({ key, label }) => {
            const day = c.workingHours[key]
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="w-28 text-sm font-medium text-foreground">{label}</span>
                {day.closed ? (
                  <span className="flex-1 text-sm text-muted-foreground">Выходной</span>
                ) : (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      type="time"
                      value={day.open}
                      className="w-32"
                      onChange={(e) => updateDay(key, { open: e.target.value })}
                    />
                    <span className="text-muted-foreground">—</span>
                    <Input
                      type="time"
                      value={day.close}
                      className="w-32"
                      onChange={(e) => updateDay(key, { close: e.target.value })}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={day.closed} onCheckedChange={(v) => updateDay(key, { closed: v })} />
                  <span className="text-xs text-muted-foreground">Выходной</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const WIDGET_CHANNELS: { key: WidgetChannelKey; label: string; placeholder: string; hint: string }[] = [
  { key: 'phone', label: 'Телефон', placeholder: '+380 00 000 00 00', hint: 'Звонок откроется в приложении телефона' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+380 00 000 00 00', hint: 'Номер в международном формате' },
  { key: 'telegram', label: 'Telegram', placeholder: '@username или ссылка', hint: 'Имя пользователя или полная ссылка t.me' },
  { key: 'viber', label: 'Viber', placeholder: '+380 00 000 00 00', hint: 'Номер телефона Viber' },
  { key: 'email', label: 'Email', placeholder: 'shop@example.com', hint: 'Откроется почтовый клиент' },
]

function WidgetSection({ data, setData }: SectionProps) {
  const w = data.contact.widget
  const setWidget = (patch: Partial<StoreSettingsData['contact']['widget']>) =>
    setData((d) => ({ ...d, contact: { ...d.contact, widget: { ...d.contact.widget, ...patch } } }))
  const setChannel = (key: WidgetChannelKey, patch: Partial<{ value: string; enabled: boolean }>) =>
    setWidget({ channels: { ...w.channels, [key]: { ...w.channels[key], [Object.keys(patch)[0]]: Object.values(patch)[0] } } })

  const allOn = WIDGET_CHANNELS.every(({ key }) => w.channels[key].enabled)
  const toggleAll = (on: boolean) => {
    const channels = { ...w.channels }
    for (const { key } of WIDGET_CHANNELS) channels[key] = { ...channels[key], enabled: on }
    setWidget({ channels })
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {/* Master toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Плавающая кнопка связи</p>
          <p className="text-xs text-muted-foreground">
            Кнопка в правом нижнем углу магазина с быстрыми контактами
          </p>
        </div>
        <Switch checked={w.enabled} onCheckedChange={(v) => setWidget({ enabled: v })} />
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground">Каналы:</span>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => toggleAll(true)} disabled={allOn}>
          <Power className="size-4" /> Включить все
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => toggleAll(false)}>
          <Power className="size-4" /> Отключить все
        </Button>
      </div>

      {/* Channels */}
      <div className="flex flex-col gap-3">
        {WIDGET_CHANNELS.map(({ key, label, placeholder, hint }) => {
          const ch = w.channels[key]
          return (
            <div key={key} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <Switch checked={ch.enabled} onCheckedChange={(v) => setChannel(key, { enabled: v })} />
              </div>
              <Input
                value={ch.value}
                placeholder={placeholder}
                onChange={(e) => setChannel(key, { value: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Кнопка появляется на витрине только если включён общий переключатель и есть хотя бы один активный канал с заполненным значением.
      </p>
    </div>
  )
}

const SOCIALS: { key: keyof StoreSettingsData['social']; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'viber', label: 'Viber' },
  { key: 'tiktok', label: 'TikTok' },
]

function SocialSection({ data, setData }: SectionProps) {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      {SOCIALS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <Label>{label}</Label>
            <Switch
              checked={data.social[key].enabled}
              onCheckedChange={(v) =>
                setData((d) => ({
                  ...d,
                  social: { ...d.social, [key]: { ...d.social[key], enabled: v } },
                }))
              }
            />
          </div>
          <Input
            value={data.social[key].url}
            placeholder={`https://...`}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                social: { ...d.social, [key]: { ...d.social[key], url: e.target.value } },
              }))
            }
          />
        </div>
      ))}
    </div>
  )
}

function EmailSection({ data, setData }: SectionProps) {
  const e = data.emailSettings
  const set = (patch: Partial<StoreSettingsData['emailSettings']>) =>
    setData((d) => ({ ...d, emailSettings: { ...d.emailSettings, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Email-уведомления</p>
          <p className="text-xs text-muted-foreground">Отправлять письма клиентам о заказах</p>
        </div>
        <Switch checked={e.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Провайдер</Label>
          <Select value={e.provider} onValueChange={(v) => set({ provider: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gmail">Gmail</SelectItem>
              <SelectItem value="smtp">SMTP</SelectItem>
              <SelectItem value="sendgrid">SendGrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Имя отправителя</Label>
          <Input value={e.fromName} onChange={(ev) => set({ fromName: ev.target.value })} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Email отправителя</Label>
        <Input
          type="email"
          value={e.fromEmail}
          onChange={(ev) => set({ fromEmail: ev.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>SMTP хост</Label>
          <Input value={e.smtpHost} onChange={(ev) => set({ smtpHost: ev.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>SMTP порт</Label>
          <Input value={e.smtpPort} onChange={(ev) => set({ smtpPort: ev.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>SMTP логин</Label>
          <Input value={e.smtpUser} onChange={(ev) => set({ smtpUser: ev.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>SMTP пароль</Label>
          <Input
            type="password"
            value={e.smtpPassword}
            onChange={(ev) => set({ smtpPassword: ev.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Совет: для безопасности храните пароль SMTP в переменной окружения SMTP_PASSWORD. Тогда
        письма будут отправляться автоматически.
      </p>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">DKIM-подпись (антиспам)</p>
          <p className="text-xs text-muted-foreground">
            Нужна только если ваш SMTP-сервер сам не подписывает письма. Gmail и SendGrid
            подписывают автоматически — оставьте поля пустыми.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>DKIM селектор</Label>
            <Input
              placeholder="mail"
              value={e.dkimSelector}
              onChange={(ev) => set({ dkimSelector: ev.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>DKIM приватный ключ (PEM)</Label>
            <Input
              type="password"
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={e.dkimPrivateKey}
              onChange={(ev) => set({ dkimPrivateKey: ev.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">
          Чтобы письма не попадали в спам — настройте DNS домена отправителя:
        </p>
        <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">SPF</span> — TXT-запись:{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              v=spf1 include:_spf.google.com ~all
            </code>{' '}
            (для Gmail; для другого SMTP — include вашего провайдера)
          </li>
          <li>
            <span className="font-semibold text-foreground">DKIM</span> — включите подпись у
            провайдера (Gmail: Admin console → Apps → Google Workspace → Gmail → Authenticate
            email) и добавьте выданную TXT-запись
          </li>
          <li>
            <span className="font-semibold text-foreground">DMARC</span> — TXT-запись{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">_dmarc.ваш-домен</code>:{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              v=DMARC1; p=quarantine; rua=mailto:admin@ваш-домен
            </code>
          </li>
          <li>
            <span className="font-semibold text-foreground">Важно</span> — «Email отправителя»
            должен совпадать с SMTP-логином, иначе письмо уйдёт от имени логина (иное значение
            станет адресом для ответов)
          </li>
        </ul>
      </div>
    </div>
  )
}

function NotificationsSection({ data, setData }: SectionProps) {
  const n = data.notifications
  const set = (patch: Partial<StoreSettingsData['notifications']>) =>
    setData((d) => ({ ...d, notifications: { ...d.notifications, ...patch } }))
  const [testing, setTesting] = useState(false)

  async function testTelegram() {
    setTesting(true)
    try {
      const { sendTestTelegram } = await import('@/app/actions/notifications')
      const res = await sendTestTelegram({ botToken: n.telegramBotToken, chatId: n.telegramChatId })
      if (res.success) toast.success('Тестовое сообщение отправлено в Telegram')
      else toast.error(res.error ?? 'Ошибка отправки')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-foreground">Уведомления о новых заказах</p>
        <p className="text-xs text-muted-foreground">
          Кому и как сообщать, когда покупатель оформил заказ. Для писем должна быть настроена
          вкладка Email (SMTP).
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Письмо покупателю</p>
          <p className="text-xs text-muted-foreground">
            Подтверждение заказа на email покупателя (если он его указал)
          </p>
        </div>
        <Switch
          checked={n.customerEmailEnabled}
          onCheckedChange={(v) => set({ customerEmailEnabled: v })}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Письмо администратору</p>
            <p className="text-xs text-muted-foreground">Оповещение о каждом новом заказе</p>
          </div>
          <Switch checked={n.adminEmailEnabled} onCheckedChange={(v) => set({ adminEmailEnabled: v })} />
        </div>
        {n.adminEmailEnabled && (
          <div className="flex flex-col gap-2">
            <Label>Email администратора</Label>
            <Input
              type="email"
              value={n.adminEmail}
              placeholder="Пусто = адрес из настроек SMTP"
              onChange={(ev) => set({ adminEmail: ev.target.value })}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Telegram администратору</p>
            <p className="text-xs text-muted-foreground">
              Мгновенное сообщение о заказе в личку или группу
            </p>
          </div>
          <Switch checked={n.telegramEnabled} onCheckedChange={(v) => set({ telegramEnabled: v })} />
        </div>
        {n.telegramEnabled && (
          <>
            <div className="flex flex-col gap-2">
              <Label>Токен бота</Label>
              <Input
                type="password"
                value={n.telegramBotToken}
                placeholder="123456789:AAF..."
                onChange={(ev) => set({ telegramBotToken: ev.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Создайте бота у @BotFather в Telegram и вставьте сюда его токен
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Chat ID</Label>
              <Input
                value={n.telegramChatId}
                placeholder="123456789 или -100123456789 (группа)"
                onChange={(ev) => set({ telegramChatId: ev.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Напишите боту /start, затем узнайте свой ID у @userinfobot. Для группы добавьте
                бота в группу.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={testTelegram}
              disabled={testing || !n.telegramBotToken || !n.telegramChatId}
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Отправить тест
            </Button>
            <p className="text-xs text-muted-foreground">
              Перед тестом сохраните настройки или заполните поля выше — тест использует введённые
              значения.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function AdsSection({ data, setData }: SectionProps) {
  const g = data.googleAds
  const set = (patch: Partial<StoreSettingsData['googleAds']>) =>
    setData((d) => ({ ...d, googleAds: { ...d.googleAds, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Отслеживание конверсий</p>
          <p className="text-xs text-muted-foreground">Google Ads conversion tracking</p>
        </div>
        <Switch checked={g.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Conversion ID</Label>
        <Input
          value={g.conversionId}
          placeholder="AW-XXXXXXXXX"
          onChange={(e) => set({ conversionId: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Conversion Label</Label>
        <Input
          value={g.conversionLabel}
          onChange={(e) => set({ conversionLabel: e.target.value })}
        />
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Google Analytics (GA4)</p>
            <p className="text-xs text-muted-foreground">
              Просмотры страниц, товаров, добавления в корзину, покупки — воронка продаж прямо в GA4
            </p>
          </div>
          <Switch checked={g.gaEnabled} onCheckedChange={(v) => set({ gaEnabled: v })} />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Label>Measurement ID</Label>
          <Input
            value={g.gaMeasurementId}
            placeholder="G-XXXXXXXXXX"
            onChange={(e) => set({ gaMeasurementId: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Найдите в Google Analytics: Администратор → Потоки данных → ваш веб-поток.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">Google Merchant Center</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Товарный фид для Google Shopping/Merchant Center. Добавьте эту ссылку в Merchant Center
          (Продукты → Фиды → «Заданное время получения»), она обновляется автоматически:
        </p>
        <MerchantFeedUrl siteUrl={data.seo.siteUrl} />
        <p className="mt-2 text-xs text-muted-foreground">
          Для отдельного фида на русском добавьте <code>?locale=ru</code> к ссылке.
        </p>
      </div>
    </div>
  )
}

function MerchantFeedUrl({ siteUrl }: { siteUrl: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const base = siteUrl?.trim() || window.location.origin
    setUrl(`${base.replace(/\/+$/, '')}/feed/google-merchant.xml`)
  }, [siteUrl])

  return (
    <div className="mt-2 flex items-center gap-2">
      <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(url)
          toast.success('Скопировано')
        }}
      >
        Копировать
      </Button>
    </div>
  )
}

function GoogleAuthSection({ data, setData }: SectionProps) {
  const g = data.googleAuth
  const set = (patch: Partial<StoreSettingsData['googleAuth']>) =>
    setData((d) => ({ ...d, googleAuth: { ...d.googleAuth, ...patch } }))
  const [showSecret, setShowSecret] = useState(false)
  const configured = Boolean(g.clientId.trim() && g.clientSecret.trim())

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Вход через Google (OAuth 2.0)</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Ключи создаются в{' '}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Google Cloud Console
          </a>{' '}
          (APIs &amp; Services → Credentials → OAuth client ID, тип «Web application»). Хранятся в
          базе данных магазина и применяются без перезапуска сервера.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Кнопка «Войти через Google»</p>
          <p className="text-xs text-muted-foreground">
            {configured
              ? 'Показывать кнопку в окне входа и регистрации'
              : 'Заполните Client ID и Client Secret, чтобы включить'}
          </p>
        </div>
        <Switch
          checked={g.enabled}
          disabled={!configured && !g.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ga-client-id">Client ID</Label>
        <Input
          id="ga-client-id"
          value={g.clientId}
          placeholder="1234567890-xxxxxxxx.apps.googleusercontent.com"
          autoComplete="off"
          onChange={(e) => set({ clientId: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ga-client-secret">Client Secret</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ga-client-secret"
            type={showSecret ? 'text' : 'password'}
            value={g.clientSecret}
            placeholder="GOCSPX-..."
            autoComplete="off"
            onChange={(e) => set({ clientSecret: e.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={showSecret ? 'Скрыть секрет' : 'Показать секрет'}
            onClick={() => setShowSecret((v) => !v)}
          >
            {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Секрет хранится в базе данных. Не передавайте его третьим лицам.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium text-foreground">Redirect URI для Google Console</p>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
          {typeof window !== 'undefined'
            ? `${window.location.origin}/api/auth/callback/google`
            : '/api/auth/callback/google'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Добавьте этот адрес в «Authorized redirect URIs» вашего OAuth-клиента.
        </p>
      </div>
    </div>
  )
}
