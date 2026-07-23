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
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'
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

function getSections(t: AdminDictionary['settings']): { key: Section; label: string; icon: typeof Store }[] {
  return [
    { key: 'general', label: t.navGeneral, icon: Store },
    { key: 'homepage', label: t.navHomepage, icon: LayoutTemplate },
    { key: 'seo', label: t.navSeo, icon: Search },
    { key: 'design', label: t.navDesign, icon: Palette },
    { key: 'branding', label: t.navBranding, icon: ImageIcon },
    { key: 'contacts', label: t.navContacts, icon: Phone },
    { key: 'widget', label: t.navWidget, icon: MessageCircle },
    { key: 'social', label: t.navSocial, icon: Share2 },
    { key: 'email', label: t.navEmail, icon: Mail },
    { key: 'notifications', label: t.navNotifications, icon: Bell },
    { key: 'ads', label: t.navAds, icon: BarChart3 },
    { key: 'googleAuth', label: t.navGoogleAuth, icon: KeyRound },
    { key: 'system', label: t.navSystem, icon: Power },
  ]
}

function getWeekDays(t: AdminDictionary['settings']): { key: WeekDay; label: string }[] {
  return [
    { key: 'mon', label: t.weekMon },
    { key: 'tue', label: t.weekTue },
    { key: 'wed', label: t.weekWed },
    { key: 'thu', label: t.weekThu },
    { key: 'fri', label: t.weekFri },
    { key: 'sat', label: t.weekSat },
    { key: 'sun', label: t.weekSun },
  ]
}

export function SettingsManager({ initial }: { initial: StoreSettingsData }) {
  const { dict } = useAdminI18n()
  const t = dict.settings
  const [data, setData] = useState<StoreSettingsData>(initial)
  const [section, setSection] = useState<Section>('general')
  const [pending, startTransition] = useTransition()
  const SECTIONS = getSections(t)

  function save() {
    startTransition(async () => {
      const res = await updateStoreSettings(data)
      if (res.success) toast.success(t.toastSettingsSaved)
      else toast.error(t.toastSettingsSaveError)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      {/*
        Decoy username/password pair. Chrome/Firefox/password managers pattern-match
        "a text field followed by a password field" as a login form and silently
        autofill it with the admin's own saved site credentials — which is exactly
        what happened to the Google OAuth Client ID/Secret and SMTP login/password
        fields below, despite them having autoComplete="off". Giving the browser a
        decoy pair to latch onto first stops it from touching the real fields.
      */}
      <div
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <input type="text" name="username" autoComplete="username" tabIndex={-1} readOnly />
        <input type="password" name="password" autoComplete="current-password" tabIndex={-1} readOnly />
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.pageSubtitle}</p>
        </div>
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {t.saveButton}
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
          {section === 'general' && <GeneralSection data={data} setData={setData} t={t} />}
          {section === 'homepage' && <HomepageSection data={data} setData={setData} t={t} />}
          {section === 'seo' && <SeoSection data={data} setData={setData} t={t} />}
          {section === 'design' && <DesignSection data={data} setData={setData} t={t} />}
          {section === 'branding' && <BrandingSection data={data} setData={setData} t={t} />}
          {section === 'contacts' && <ContactsSection data={data} setData={setData} t={t} />}
          {section === 'widget' && <WidgetSection data={data} setData={setData} t={t} />}
          {section === 'social' && <SocialSection data={data} setData={setData} t={t} />}
          {section === 'email' && <EmailSection data={data} setData={setData} t={t} />}
          {section === 'notifications' && <NotificationsSection data={data} setData={setData} t={t} />}
          {section === 'ads' && <AdsSection data={data} setData={setData} t={t} />}
          {section === 'googleAuth' && <GoogleAuthSection data={data} setData={setData} t={t} />}
          {section === 'system' && <SystemSection t={t} />}
        </div>
      </div>
    </div>
  )
}

type SectionProps = {
  data: StoreSettingsData
  setData: React.Dispatch<React.SetStateAction<StoreSettingsData>>
  t: AdminDictionary['settings']
}

function SystemSection({ t }: { t: AdminDictionary['settings'] }) {
  const [clearing, startClearing] = useTransition()

  function handleClearCache() {
    startClearing(async () => {
      try {
        await clearSiteCache()
        toast.success(t.toastCacheCleared)
      } catch {
        toast.error(t.toastCacheClearError)
      }
    })
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t.cacheTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.cacheDesc}</p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.clearCacheLabel}</p>
          <p className="text-xs text-muted-foreground">{t.clearCacheHint}</p>
        </div>
        <Button variant="outline" onClick={handleClearCache} disabled={clearing}>
          {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          {t.clearCacheButton}
        </Button>
      </div>
    </div>
  )
}

function GeneralSection({ data, setData, t }: SectionProps) {
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-name">{t.storeNameLabel}</Label>
        <Input
          id="s-name"
          value={data.storeName}
          onChange={(e) => setData((d) => ({ ...d, storeName: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-desc">{t.storeDescLabel}</Label>
        <Textarea
          id="s-desc"
          rows={3}
          value={data.storeDescription ?? ''}
          onChange={(e) => setData((d) => ({ ...d, storeDescription: e.target.value }))}
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.openCartTitle}</p>
          <p className="text-xs text-muted-foreground">{t.openCartDesc}</p>
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
function HomepageSection({ data, setData, t }: SectionProps) {
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
        <h2 className="text-base font-semibold text-foreground">{t.heroTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.heroDesc}</p>
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
            {l === 'uk' ? t.localeUk : t.localeRu}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-badge">{t.heroBadgeLabel}</Label>
        <p className="text-xs text-muted-foreground">{t.heroBadgeHint}</p>
        <Input id="hero-badge" value={hero.badge} onChange={(e) => setHero('badge', e.target.value)} placeholder={ph.badge} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-title">{t.heroTitleLabel}</Label>
        <Input id="hero-title" value={hero.title} onChange={(e) => setHero('title', e.target.value)} placeholder={ph.title} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-text">{t.heroTextLabel}</Label>
        <Textarea id="hero-text" rows={3} value={hero.text} onChange={(e) => setHero('text', e.target.value)} placeholder={ph.text} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hero-btn">{t.heroButtonLabel}</Label>
        <p className="text-xs text-muted-foreground">{t.heroButtonHint}</p>
        <Input id="hero-btn" value={hero.buttonText} onChange={(e) => setHero('buttonText', e.target.value)} placeholder={ph.buttonText} />
      </div>

      <ImageField
        t={t}
        label={t.heroImageLabel}
        hint={t.heroImageHint}
        value={data.homeHero.imageUrl || null}
        onChange={(v) => setData((d) => ({ ...d, homeHero: { ...d.homeHero, imageUrl: v } }))}
      />
    </div>
  )
}

function SeoSection({ data, setData, t }: SectionProps) {
  const seo = data.seo
  const setSeo = (patch: Partial<StoreSettingsData['seo']>) =>
    setData((d) => ({ ...d, seo: { ...d.seo, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-domain">{t.domainLabel}</Label>
        <Input
          id="seo-domain"
          value={seo.siteUrl}
          placeholder="https://mystore.com"
          inputMode="url"
          onChange={(e) => setSeo({ siteUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.domainHint}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-title">{t.metaTitleLabel}</Label>
        <Input
          id="seo-title"
          value={seo.metaTitle}
          maxLength={70}
          placeholder={`${data.storeName || t.storeNameLabel} ${t.onlineStoreSuffix}`}
          onChange={(e) => setSeo({ metaTitle: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{seo.metaTitle.length}/70 {t.charsCount}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-desc">{t.metaDescLabel}</Label>
        <Textarea
          id="seo-desc"
          rows={3}
          maxLength={170}
          value={seo.metaDescription}
          placeholder={t.metaDescPlaceholder}
          onChange={(e) => setSeo({ metaDescription: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{seo.metaDescription.length}/170 {t.charsCount}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-keywords">{t.keywordsLabel}</Label>
        <Input
          id="seo-keywords"
          value={seo.keywords}
          placeholder={t.keywordsPlaceholder}
          onChange={(e) => setSeo({ keywords: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.keywordsHint}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="seo-gsc">Google Search Console</Label>
        <Input
          id="seo-gsc"
          value={seo.googleVerification}
          placeholder={t.gscPlaceholder}
          onChange={(e) => setSeo({ googleVerification: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.gscHint}</p>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.indexingTitle}</p>
          <p className="text-xs text-muted-foreground">{t.indexingDesc}</p>
        </div>
        <Switch
          checked={seo.indexingEnabled}
          onCheckedChange={(v) => setSeo({ indexingEnabled: v })}
        />
      </div>
    </div>
  )
}

function DesignSection({ data, setData, t }: SectionProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t.templateTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.templateDesc}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((tpl) => {
            const active = data.activeTemplate === tpl.id
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setData((d) => ({ ...d, activeTemplate: tpl.id }))}
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
                {tpl.premium && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                    {t.premiumBadge}
                  </span>
                )}
                {/* Mini storefront preview */}
                <div
                  className="flex flex-col gap-2 rounded-lg p-3"
                  style={{ backgroundColor: tpl.swatches.bg, borderRadius: tpl.radius }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="h-2 w-14 rounded-full"
                      style={{ backgroundColor: tpl.swatches.primary }}
                    />
                    <span
                      className="h-2 w-6 rounded-full"
                      style={{ backgroundColor: tpl.swatches.accent }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-1.5 p-2"
                        style={{
                          backgroundColor: tpl.swatches.card,
                          borderRadius: `calc(${tpl.radius} * 0.6)`,
                        }}
                      >
                        <span
                          className="h-6 w-full"
                          style={{
                            backgroundColor: tpl.swatches.accent,
                            borderRadius: `calc(${tpl.radius} * 0.4)`,
                          }}
                        />
                        <span
                          className="h-1.5 w-3/4 rounded-full"
                          style={{ backgroundColor: tpl.swatches.primary, opacity: 0.7 }}
                        />
                        <span
                          className="h-4 w-full"
                          style={{
                            backgroundColor: tpl.swatches.primary,
                            borderRadius: `calc(${tpl.radius} * 0.4)`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{tpl.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex max-w-xl flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t.defaultLangTitle}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t.defaultLangDesc}</p>
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
  t,
}: {
  label: string
  hint: string
  value: string | null
  onChange: (v: string) => void
  size?: number
  t: AdminDictionary['settings']
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
      if (!res.ok || !data.url) throw new Error(data.error || t.imageUploadError)
      onChange(data.url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.imageUploadError)
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
          aria-label={value ? `${t.imageReplaceAria}: ${label}` : `${t.imageUploadAria}: ${label}`}
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
              {value ? t.imageReplace : t.imageChooseFile}
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
                {t.imageDelete}
              </Button>
            )}
          </div>
          <Input
            value={value ?? ''}
            placeholder={t.imageUrlPlaceholder}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

function BrandingSection({ data, setData, t }: SectionProps) {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <ImageField
        t={t}
        label={t.logoLabel}
        hint={t.logoHint}
        value={data.logoUrl}
        onChange={(v) => setData((d) => ({ ...d, logoUrl: v }))}
      />
      <ImageField
        t={t}
        label={t.faviconLabel}
        hint={t.faviconHint}
        value={data.faviconUrl}
        onChange={(v) => setData((d) => ({ ...d, faviconUrl: v }))}
        size={48}
      />
    </div>
  )
}

function ContactsSection({ data, setData, t }: SectionProps) {
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
  const WEEK_DAYS = getWeekDays(t)

  return (
    <div className="flex max-w-xl flex-col gap-8">
      {/* Phones */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t.phonesTitle}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t.phonesDesc}</p>
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
                aria-label={t.removePhoneAria}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {phones.length < 3 && (
          <Button type="button" variant="outline" size="sm" className="w-fit gap-2" onClick={addPhone}>
            <Plus className="size-4" /> {t.addPhoneButton}
          </Button>
        )}
      </div>

      {/* Address */}
      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-muted-foreground" />
          <Label htmlFor="c-address" className="text-base font-semibold">
            {t.addressTitle}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{t.addressOptional}</span>
          </Label>
        </div>
        <Textarea
          id="c-address"
          rows={2}
          value={c.address}
          placeholder={t.addressPlaceholder}
          onChange={(e) => setContact({ address: e.target.value })}
        />
      </div>

      {/* Working hours */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">{t.hoursTitle}</h2>
        </div>
        <div className="flex flex-col gap-2">
          {WEEK_DAYS.map(({ key, label }) => {
            const day = c.workingHours[key]
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                <span className="w-28 text-sm font-medium text-foreground">{label}</span>
                {day.closed ? (
                  <span className="flex-1 text-sm text-muted-foreground">{t.dayOff}</span>
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
                  <span className="text-xs text-muted-foreground">{t.dayOff}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getWidgetChannels(t: AdminDictionary['settings']): { key: WidgetChannelKey; label: string; placeholder: string; hint: string }[] {
  return [
    { key: 'phone', label: t.channelPhoneLabel, placeholder: '+380 00 000 00 00', hint: t.channelPhoneHint },
    { key: 'whatsapp', label: t.channelWhatsappLabel, placeholder: '+380 00 000 00 00', hint: t.channelWhatsappHint },
    { key: 'telegram', label: t.channelTelegramLabel, placeholder: t.channelTelegramPlaceholder, hint: t.channelTelegramHint },
    { key: 'viber', label: t.channelViberLabel, placeholder: '+380 00 000 00 00', hint: t.channelViberHint },
    { key: 'email', label: t.channelEmailLabel, placeholder: 'shop@example.com', hint: t.channelEmailHint },
  ]
}

function WidgetSection({ data, setData, t }: SectionProps) {
  const WIDGET_CHANNELS = getWidgetChannels(t)
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
          <p className="text-sm font-medium text-foreground">{t.widgetTitle}</p>
          <p className="text-xs text-muted-foreground">{t.widgetDesc}</p>
        </div>
        <Switch checked={w.enabled} onCheckedChange={(v) => setWidget({ enabled: v })} />
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted-foreground">{t.channelsLabel}</span>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => toggleAll(true)} disabled={allOn}>
          <Power className="size-4" /> {t.enableAllButton}
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => toggleAll(false)}>
          <Power className="size-4" /> {t.disableAllButton}
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
      <p className="text-xs text-muted-foreground">{t.widgetFootnote}</p>
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

function EmailSection({ data, setData, t }: SectionProps) {
  const e = data.emailSettings
  const set = (patch: Partial<StoreSettingsData['emailSettings']>) =>
    setData((d) => ({ ...d, emailSettings: { ...d.emailSettings, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.emailToggleTitle}</p>
          <p className="text-xs text-muted-foreground">{t.emailToggleDesc}</p>
        </div>
        <Switch checked={e.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>{t.providerLabel}</Label>
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
          <Label>{t.fromNameLabel}</Label>
          <Input value={e.fromName} onChange={(ev) => set({ fromName: ev.target.value })} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t.fromEmailLabel}</Label>
        <Input
          type="email"
          value={e.fromEmail}
          onChange={(ev) => set({ fromEmail: ev.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>{t.smtpHostLabel}</Label>
          <Input value={e.smtpHost} onChange={(ev) => set({ smtpHost: ev.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.smtpPortLabel}</Label>
          <Input value={e.smtpPort} onChange={(ev) => set({ smtpPort: ev.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.smtpUserLabel}</Label>
          <Input
            name="smtp-username"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            value={e.smtpUser}
            onChange={(ev) => set({ smtpUser: ev.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.smtpPasswordLabel}</Label>
          <Input
            type="password"
            name="smtp-password"
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            value={e.smtpPassword}
            onChange={(ev) => set({ smtpPassword: ev.target.value })}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.smtpTip}</p>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.dkimTitle}</p>
          <p className="text-xs text-muted-foreground">{t.dkimDesc}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>{t.dkimSelectorLabel}</Label>
            <Input
              placeholder="mail"
              value={e.dkimSelector}
              onChange={(ev) => set({ dkimSelector: ev.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t.dkimKeyLabel}</Label>
            <Input
              type="password"
              name="dkim-private-key"
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={e.dkimPrivateKey}
              onChange={(ev) => set({ dkimPrivateKey: ev.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">{t.dnsBoxTitle}</p>
        <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">SPF</span> — {t.dnsSpf}
          </li>
          <li>
            <span className="font-semibold text-foreground">DKIM</span> — {t.dnsDkim}
          </li>
          <li>
            <span className="font-semibold text-foreground">DMARC</span> — {t.dnsDmarc}
          </li>
          <li>
            <span className="font-semibold text-foreground">{t.dnsImportantLabel}</span> — {t.dnsImportant}
          </li>
        </ul>
      </div>
    </div>
  )
}

function NotificationsSection({ data, setData, t }: SectionProps) {
  const n = data.notifications
  const set = (patch: Partial<StoreSettingsData['notifications']>) =>
    setData((d) => ({ ...d, notifications: { ...d.notifications, ...patch } }))
  const [testing, setTesting] = useState(false)

  async function testTelegram() {
    setTesting(true)
    try {
      const { sendTestTelegram } = await import('@/app/actions/notifications')
      const res = await sendTestTelegram({ botToken: n.telegramBotToken, chatId: n.telegramChatId })
      if (res.success) toast.success(t.toastTelegramSent)
      else toast.error(res.error ?? t.toastTelegramError)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-foreground">{t.notifSectionTitle}</p>
        <p className="text-xs text-muted-foreground">{t.notifSectionDesc}</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.customerEmailTitle}</p>
          <p className="text-xs text-muted-foreground">{t.customerEmailDesc}</p>
        </div>
        <Switch
          checked={n.customerEmailEnabled}
          onCheckedChange={(v) => set({ customerEmailEnabled: v })}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t.adminEmailTitle}</p>
            <p className="text-xs text-muted-foreground">{t.adminEmailDesc}</p>
          </div>
          <Switch checked={n.adminEmailEnabled} onCheckedChange={(v) => set({ adminEmailEnabled: v })} />
        </div>
        {n.adminEmailEnabled && (
          <div className="flex flex-col gap-2">
            <Label>{t.adminEmailLabel}</Label>
            <Input
              type="email"
              value={n.adminEmail}
              placeholder={t.adminEmailPlaceholder}
              onChange={(ev) => set({ adminEmail: ev.target.value })}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t.telegramTitle}</p>
            <p className="text-xs text-muted-foreground">{t.telegramDesc}</p>
          </div>
          <Switch checked={n.telegramEnabled} onCheckedChange={(v) => set({ telegramEnabled: v })} />
        </div>
        {n.telegramEnabled && (
          <>
            <div className="flex flex-col gap-2">
              <Label>{t.telegramTokenLabel}</Label>
              <Input
                type="password"
                name="telegram-bot-token"
                autoComplete="new-password"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                data-form-type="other"
                value={n.telegramBotToken}
                placeholder="123456789:AAF..."
                onChange={(ev) => set({ telegramBotToken: ev.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t.telegramTokenHint}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t.telegramChatIdLabel}</Label>
              <Input
                value={n.telegramChatId}
                placeholder={t.telegramChatIdPlaceholder}
                onChange={(ev) => set({ telegramChatId: ev.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t.telegramChatIdHint}</p>
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
              {t.testButton}
            </Button>
            <p className="text-xs text-muted-foreground">{t.testNote}</p>
          </>
        )}
      </div>
    </div>
  )
}

function AdsSection({ data, setData, t }: SectionProps) {
  const g = data.googleAds
  const set = (patch: Partial<StoreSettingsData['googleAds']>) =>
    setData((d) => ({ ...d, googleAds: { ...d.googleAds, ...patch } }))

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.convTitle}</p>
          <p className="text-xs text-muted-foreground">{t.convDesc}</p>
        </div>
        <Switch checked={g.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t.conversionIdLabel}</Label>
        <Input
          value={g.conversionId}
          placeholder="AW-XXXXXXXXX"
          onChange={(e) => set({ conversionId: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t.conversionLabelLabel}</Label>
        <Input
          value={g.conversionLabel}
          onChange={(e) => set({ conversionLabel: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.enhancedConvTitle}</p>
          <p className="text-xs text-muted-foreground">{t.enhancedConvDesc}</p>
        </div>
        <Switch
          checked={g.enhancedConversionsEnabled}
          onCheckedChange={(v) => set({ enhancedConversionsEnabled: v })}
        />
      </div>

      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">{t.gaTitle}</p>
            <p className="text-xs text-muted-foreground">{t.gaDesc}</p>
          </div>
          <Switch checked={g.gaEnabled} onCheckedChange={(v) => set({ gaEnabled: v })} />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Label>{t.gaMeasurementLabel}</Label>
          <Input
            value={g.gaMeasurementId}
            placeholder="G-XXXXXXXXXX"
            onChange={(e) => set({ gaMeasurementId: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t.gaHint}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground">{t.merchantTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.merchantDesc}</p>
        <MerchantFeedUrl siteUrl={data.seo.siteUrl} t={t} />
        <p className="mt-2 text-xs text-muted-foreground">{t.merchantLocaleNote}</p>
        <MerchantFeedFields data={data} setData={setData} t={t} />
      </div>
    </div>
  )
}

function MerchantFeedFields({ data, setData, t }: SectionProps) {
  const m = data.merchantFeed
  const set = (patch: Partial<StoreSettingsData['merchantFeed']>) =>
    setData((d) => ({ ...d, merchantFeed: { ...d.merchantFeed, ...patch } }))

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
      <div className="flex flex-col gap-2">
        <Label>{t.merchantCategoryLabel}</Label>
        <Input
          value={m.googleProductCategory}
          placeholder={t.merchantCategoryPlaceholder}
          onChange={(e) => set({ googleProductCategory: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t.merchantCategoryHint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>{t.merchantShippingPriceLabel}</Label>
          <Input
            value={m.shippingPrice}
            placeholder={t.merchantShippingPricePlaceholder}
            onChange={(e) => set({ shippingPrice: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t.merchantShippingCountryLabel}</Label>
          <Input
            value={m.shippingCountry}
            placeholder="UA"
            onChange={(e) => set({ shippingCountry: e.target.value.toUpperCase().slice(0, 2) })}
          />
        </div>
      </div>
    </div>
  )
}

function MerchantFeedUrl({ siteUrl, t }: { siteUrl: string; t: AdminDictionary['settings'] }) {
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
          toast.success(t.toastCopied)
        }}
      >
        {t.copyButton}
      </Button>
    </div>
  )
}

function GoogleAuthSection({ data, setData, t }: SectionProps) {
  const g = data.googleAuth
  const set = (patch: Partial<StoreSettingsData['googleAuth']>) =>
    setData((d) => ({ ...d, googleAuth: { ...d.googleAuth, ...patch } }))
  const [showSecret, setShowSecret] = useState(false)
  const configured = Boolean(g.clientId.trim() && g.clientSecret.trim())

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t.googleAuthTitle}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t.googleAuthDescPrefix}{' '}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t.googleAuthDescLink}
          </a>{' '}
          {t.googleAuthDescSuffix}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t.googleAuthToggleTitle}</p>
          <p className="text-xs text-muted-foreground">
            {configured ? t.googleAuthToggleConfigured : t.googleAuthToggleNotConfigured}
          </p>
        </div>
        <Switch
          checked={g.enabled}
          disabled={!configured && !g.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ga-client-id">{t.clientIdLabel}</Label>
        <Input
          id="ga-client-id"
          name="google-oauth-client-id"
          value={g.clientId}
          placeholder="1234567890-xxxxxxxx.apps.googleusercontent.com"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          data-form-type="other"
          onChange={(e) => set({ clientId: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ga-client-secret">{t.clientSecretLabel}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ga-client-secret"
            name="google-oauth-client-secret"
            type={showSecret ? 'text' : 'password'}
            value={g.clientSecret}
            placeholder="GOCSPX-..."
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            onChange={(e) => set({ clientSecret: e.target.value })}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={showSecret ? t.hideSecretAria : t.showSecretAria}
            onClick={() => setShowSecret((v) => !v)}
          >
            {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t.secretHint}</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium text-foreground">{t.redirectTitle}</p>
        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
          {typeof window !== 'undefined'
            ? `${window.location.origin}/api/auth/callback/google`
            : '/api/auth/callback/google'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t.redirectHint}</p>
      </div>
    </div>
  )
}
