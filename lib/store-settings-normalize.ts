// Pure helpers for store_settings rows. No DB / next/cache imports - unit tests
// can exercise malformed live payloads without opening a Postgres pool.
//
// Live magazine-test-ten has a store_settings row that predates some columns
// (locale_prompt_mode, min_order, ...) and JSON that is not always the current
// shape. Drizzle `select()` asks for every schema column and 500s when one is
// missing; shallow spreads of a string/array JSON blob then crash the admin
// settings page on first paint. Normalize everything to DEFAULTS instead.

export type SocialLink = { url: string; enabled: boolean }
export type DayHours = { open: string; close: string; closed: boolean }
export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type WidgetChannelKey = 'phone' | 'email' | 'viber' | 'telegram' | 'whatsapp'
export type WidgetChannel = { value: string; enabled: boolean }
export type ContactWidget = {
  enabled: boolean
  channels: Record<WidgetChannelKey, WidgetChannel>
}

export type ContactData = {
  phones: string[]
  address: string
  workingHours: Record<WeekDay, DayHours>
  widget: ContactWidget
}

export type SeoSettings = {
  siteUrl: string
  metaTitle: string
  metaDescription: string
  keywords: string
  googleVerification: string
  indexingEnabled: boolean
  ogImageUrl: string | null
}

export type NotificationSettings = {
  customerEmailEnabled: boolean
  adminEmailEnabled: boolean
  adminEmail: string
  telegramEnabled: boolean
  telegramBotToken: string
  telegramChatId: string
}

export type GoogleAuthSettings = {
  enabled: boolean
  clientId: string
  clientSecret: string
}

export type HomeHeroLocaleContent = {
  badge: string
  title: string
  text: string
  buttonText: string
}

export type HomeHeroSlideLocale = {
  badge: string
  title: string
  text: string
  cta: string
}

export type HomeHeroSlide = {
  image: string
  href: string
  uk: HomeHeroSlideLocale
  ru: HomeHeroSlideLocale
}

export type HomeHeroSettings = {
  imageUrl: string
  uk: HomeHeroLocaleContent
  ru: HomeHeroLocaleContent
  slides: HomeHeroSlide[]
}

export type HomeBenefitItem = {
  title: string
  text: string
  iconUrl: string
}

export type HomeBenefitsSettings = {
  uk: HomeBenefitItem[]
  ru: HomeBenefitItem[]
}

export type MinOrderSettings = {
  enabled: boolean
  amount: number
}

export type StoreSettingsData = {
  storeName: string
  storeDescription: string | null
  logoUrl: string | null
  faviconUrl: string | null
  openCartAfterAdd: boolean
  storefrontCacheEnabled: boolean
  defaultLocale: string
  localePromptMode: 'modal' | 'browser'
  activeTemplate: string
  seo: SeoSettings
  social: {
    instagram: SocialLink
    telegram: SocialLink
    viber: SocialLink
    tiktok: SocialLink
  }
  googleAds: {
    conversionId: string
    conversionLabel: string
    enabled: boolean
    gaEnabled: boolean
    gaMeasurementId: string
    enhancedConversionsEnabled: boolean
  }
  merchantFeed: {
    googleProductCategory: string
    shippingPrice: string
    shippingCountry: string
  }
  emailSettings: {
    provider: string
    fromEmail: string
    fromName: string
    smtpHost: string
    smtpPort: string
    smtpUser: string
    smtpPassword: string
    dkimSelector: string
    dkimPrivateKey: string
    enabled: boolean
  }
  contact: ContactData
  notifications: NotificationSettings
  googleAuth: GoogleAuthSettings
  homeHero: HomeHeroSettings
  homeBenefits: HomeBenefitsSettings
  minOrder: MinOrderSettings
}

export const DEFAULTS: StoreSettingsData = {
  storeName: 'Мій магазин',
  storeDescription: '',
  logoUrl: null,
  faviconUrl: null,
  openCartAfterAdd: true,
  storefrontCacheEnabled: false,
  defaultLocale: 'uk',
  localePromptMode: 'browser',
  activeTemplate: 'classic',
  seo: {
    siteUrl: '',
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    googleVerification: '',
    indexingEnabled: true,
    ogImageUrl: null,
  },
  social: {
    instagram: { url: '', enabled: false },
    telegram: { url: '', enabled: false },
    viber: { url: '', enabled: false },
    tiktok: { url: '', enabled: false },
  },
  googleAds: {
    conversionId: '',
    conversionLabel: '',
    enabled: false,
    gaEnabled: false,
    gaMeasurementId: '',
    enhancedConversionsEnabled: false,
  },
  merchantFeed: { googleProductCategory: '', shippingPrice: '', shippingCountry: 'UA' },
  emailSettings: {
    provider: 'gmail',
    fromEmail: '',
    fromName: '',
    smtpHost: 'smtp.gmail.com',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    dkimSelector: '',
    dkimPrivateKey: '',
    enabled: false,
  },
  notifications: {
    customerEmailEnabled: true,
    adminEmailEnabled: false,
    adminEmail: '',
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
  },
  googleAuth: {
    enabled: false,
    clientId: '',
    clientSecret: '',
  },
  homeHero: {
    imageUrl: '',
    uk: { badge: '', title: '', text: '', buttonText: '' },
    ru: { badge: '', title: '', text: '', buttonText: '' },
    slides: [],
  },
  homeBenefits: {
    uk: [
      { title: 'Швидка доставка', text: 'Нова Пошта та Укрпошта по всій Україні', iconUrl: '' },
      { title: 'Гарантія якості', text: 'Офіційна гарантія на всі товари', iconUrl: '' },
      { title: 'Зручна оплата', text: 'Накладений платіж або онлайн', iconUrl: '' },
      { title: 'Підтримка 24/7', text: "Завжди на зв'язку та готові допомогти", iconUrl: '' },
    ],
    ru: [
      { title: 'Быстрая доставка', text: 'Нова Пошта и Укрпошта по всей Украине', iconUrl: '' },
      { title: 'Гарантия качества', text: 'Официальная гарантия на все товары', iconUrl: '' },
      { title: 'Удобная оплата', text: 'Наложенный платёж или онлайн', iconUrl: '' },
      { title: 'Поддержка 24/7', text: 'Всегда на связи и готовы помочь', iconUrl: '' },
    ],
  },
  minOrder: { enabled: false, amount: 0 },
  contact: {
    phones: [''],
    address: '',
    workingHours: {
      mon: { open: '09:00', close: '18:00', closed: false },
      tue: { open: '09:00', close: '18:00', closed: false },
      wed: { open: '09:00', close: '18:00', closed: false },
      thu: { open: '09:00', close: '18:00', closed: false },
      fri: { open: '09:00', close: '18:00', closed: false },
      sat: { open: '10:00', close: '16:00', closed: false },
      sun: { open: '10:00', close: '16:00', closed: true },
    },
    widget: {
      enabled: false,
      channels: {
        phone: { value: '', enabled: false },
        email: { value: '', enabled: false },
        viber: { value: '', enabled: false },
        telegram: { value: '', enabled: false },
        whatsapp: { value: '', enabled: false },
      },
    },
  },
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function asStringOrNull(value: unknown, fallback: string | null): string | null {
  if (value === null) return null
  if (typeof value === 'string') return value
  return fallback
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  return fallback
}

function col(row: Record<string, unknown>, camel: string, snake: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, camel)) return row[camel]
  if (Object.prototype.hasOwnProperty.call(row, snake)) return row[snake]
  return undefined
}

function mergeObject<T extends Record<string, unknown>>(defaults: T, stored: unknown): T {
  const src = asRecord(stored)
  if (!src) return { ...defaults }
  const out = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (src[key as string] !== undefined) {
      const current = out[key]
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        ;(out as Record<string, unknown>)[key as string] = mergeObject(
          current as Record<string, unknown>,
          src[key as string],
        )
      } else {
        ;(out as Record<string, unknown>)[key as string] = src[key as string]
      }
    }
  }
  return out
}

function emptySlide(): HomeHeroSlide {
  return {
    image: '',
    href: '',
    uk: { badge: '', title: '', text: '', cta: '' },
    ru: { badge: '', title: '', text: '', cta: '' },
  }
}

export function mergeHomeHero(stored: unknown): HomeHeroSettings {
  const src = asRecord(stored)
  if (!src) return DEFAULTS.homeHero
  const rawSlides = src.slides
  const slides = Array.isArray(rawSlides)
    ? rawSlides.slice(0, 4).map((s) => {
        const slide = asRecord(s)
        if (!slide) return emptySlide()
        return {
          ...emptySlide(),
          image: asString(slide.image, ''),
          href: asString(slide.href, ''),
          uk: { ...emptySlide().uk, ...asRecord(slide.uk) },
          ru: { ...emptySlide().ru, ...asRecord(slide.ru) },
        }
      })
    : []
  return {
    imageUrl: asString(src.imageUrl, ''),
    uk: { ...DEFAULTS.homeHero.uk, ...asRecord(src.uk) },
    ru: { ...DEFAULTS.homeHero.ru, ...asRecord(src.ru) },
    slides,
  }
}

export function mergeHomeBenefits(stored: unknown): HomeBenefitsSettings {
  const src = asRecord(stored)
  if (!src) return DEFAULTS.homeBenefits
  const mergeLocale = (defaults: HomeBenefitItem[], items: unknown) => {
    const list = Array.isArray(items) ? items : []
    return defaults.map((d, i) => {
      const item = asRecord(list[i])
      return item ? { ...d, ...item } : d
    })
  }
  return {
    uk: mergeLocale(DEFAULTS.homeBenefits.uk, src.uk),
    ru: mergeLocale(DEFAULTS.homeBenefits.ru, src.ru),
  }
}

export function mergeContact(stored: unknown): ContactData {
  const src = asRecord(stored)
  if (!src) return DEFAULTS.contact
  const wh = { ...DEFAULTS.contact.workingHours }
  const storedHours = asRecord(src.workingHours)
  if (storedHours) {
    for (const day of Object.keys(wh) as WeekDay[]) {
      const dayHours = asRecord(storedHours[day])
      if (dayHours) wh[day] = { ...wh[day], ...dayHours }
    }
  }
  const channels = { ...DEFAULTS.contact.widget.channels }
  const widget = asRecord(src.widget)
  const storedChannels = asRecord(widget?.channels)
  if (storedChannels) {
    for (const key of Object.keys(channels) as WidgetChannelKey[]) {
      const ch = asRecord(storedChannels[key])
      if (ch) channels[key] = { ...channels[key], ...ch }
    }
  }
  const phones = Array.isArray(src.phones)
    ? src.phones.filter((p): p is string => typeof p === 'string')
    : []
  return {
    phones: phones.length ? phones : DEFAULTS.contact.phones,
    address: asString(src.address, DEFAULTS.contact.address),
    workingHours: wh,
    widget: {
      enabled: asBool(widget?.enabled, DEFAULTS.contact.widget.enabled),
      channels,
    },
  }
}

function mergeSocial(stored: unknown): StoreSettingsData['social'] {
  const src = asRecord(stored)
  const out = {
    instagram: { ...DEFAULTS.social.instagram },
    telegram: { ...DEFAULTS.social.telegram },
    viber: { ...DEFAULTS.social.viber },
    tiktok: { ...DEFAULTS.social.tiktok },
  }
  if (!src) return out
  for (const key of ['instagram', 'telegram', 'viber', 'tiktok'] as const) {
    const item = asRecord(src[key])
    if (item) out[key] = { ...out[key], url: asString(item.url, out[key].url), enabled: asBool(item.enabled, out[key].enabled) }
  }
  return out
}

export function stripSecrets(s: StoreSettingsData): StoreSettingsData {
  return {
    ...s,
    emailSettings: { ...s.emailSettings, smtpUser: '', smtpPassword: '', dkimPrivateKey: '' },
    notifications: { ...s.notifications, telegramBotToken: '', telegramChatId: '' },
    googleAuth: { ...s.googleAuth, clientSecret: '' },
  }
}

/** Map a live DB row (snake_case from `SELECT *` or camelCase from drizzle) onto DEFAULTS. */
export function normalizeStoreSettingsRow(row: unknown): StoreSettingsData {
  const src = asRecord(row)
  if (!src) return DEFAULTS
  return {
    storeName: asString(col(src, 'storeName', 'store_name'), DEFAULTS.storeName),
    storeDescription: asStringOrNull(col(src, 'storeDescription', 'store_description'), DEFAULTS.storeDescription),
    logoUrl: asStringOrNull(col(src, 'logoUrl', 'logo_url'), DEFAULTS.logoUrl),
    faviconUrl: asStringOrNull(col(src, 'faviconUrl', 'favicon_url'), DEFAULTS.faviconUrl),
    openCartAfterAdd: asBool(col(src, 'openCartAfterAdd', 'open_cart_after_add'), DEFAULTS.openCartAfterAdd),
    storefrontCacheEnabled: asBool(
      col(src, 'storefrontCacheEnabled', 'storefront_cache_enabled'),
      DEFAULTS.storefrontCacheEnabled,
    ),
    defaultLocale: asString(col(src, 'defaultLocale', 'default_locale'), DEFAULTS.defaultLocale) || 'uk',
    localePromptMode: col(src, 'localePromptMode', 'locale_prompt_mode') === 'modal' ? 'modal' : 'browser',
    activeTemplate: asString(col(src, 'activeTemplate', 'active_template'), DEFAULTS.activeTemplate) || 'classic',
    seo: mergeObject(DEFAULTS.seo, col(src, 'seo', 'seo')),
    social: mergeSocial(col(src, 'social', 'social')),
    googleAds: mergeObject(DEFAULTS.googleAds, col(src, 'googleAds', 'google_ads')),
    merchantFeed: mergeObject(DEFAULTS.merchantFeed, col(src, 'merchantFeed', 'merchant_feed')),
    emailSettings: mergeObject(DEFAULTS.emailSettings, col(src, 'emailSettings', 'email_settings')),
    contact: mergeContact(col(src, 'contact', 'contact')),
    notifications: mergeObject(DEFAULTS.notifications, col(src, 'notifications', 'notifications')),
    googleAuth: mergeObject(DEFAULTS.googleAuth, col(src, 'googleAuth', 'google_auth')),
    homeHero: mergeHomeHero(col(src, 'homeHero', 'home_hero')),
    homeBenefits: mergeHomeBenefits(col(src, 'homeBenefits', 'home_benefits')),
    minOrder: (() => {
      const merged = mergeObject(DEFAULTS.minOrder, col(src, 'minOrder', 'min_order'))
      const amount = Number(merged.amount)
      return {
        enabled: asBool(merged.enabled, DEFAULTS.minOrder.enabled),
        amount: Number.isFinite(amount) ? amount : 0,
      }
    })(),
  }
}
