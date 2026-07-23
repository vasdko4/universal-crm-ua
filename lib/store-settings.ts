// Plain (non-"use server") module for reading store settings.
//
// SECURITY: this file intentionally has NO 'use server' directive. Every
// exported function in a 'use server' file becomes an independently
// invocable HTTP endpoint regardless of whether any client component
// actually calls it — so the full settings row (which includes real secrets:
// SMTP password, DKIM private key, Telegram bot token, Google OAuth client
// secret) must never be read by a function that lives in one of those files.
// getStoreSettingsInternal() below is a plain server-side function: it can
// only ever be called from other server-side code (Server Components,
// route handlers, cron/library code), never directly over the network.
//
// - app/actions/settings-store.ts exposes a permission-gated getStoreSettings()
//   (full data, for the admin settings page) and an unguarded
//   getPublicStoreSettings() (secrets stripped, for public pages) — both
//   built on top of this function.
// - System-level code that needs the real secrets to operate (sending order
//   emails, Telegram alerts, Nova Poshta tracking sync, SEO metadata) should
//   import getStoreSettingsInternal() directly from here instead of going
//   through the gated action, since it runs during customer-facing flows
//   with no admin session (e.g. right after an anonymous checkout).
import { eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { storeSettings } from '@/lib/db/schema'

export const STORE_SETTINGS_TAG = 'store-settings'

export type SocialLink = { url: string; enabled: boolean }
export type DayHours = { open: string; close: string; closed: boolean }
export type WeekDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

// Channels shown in the floating "Contact us" widget on the storefront.
export type WidgetChannelKey = 'phone' | 'email' | 'viber' | 'telegram' | 'whatsapp'
export type WidgetChannel = { value: string; enabled: boolean }
export type ContactWidget = {
  // Master toggle for the floating button.
  enabled: boolean
  channels: Record<WidgetChannelKey, WidgetChannel>
}

export type ContactData = {
  // Up to 3 phone numbers. Empty strings are ignored on the storefront.
  phones: string[]
  // Optional physical store address.
  address: string
  // Per-day working hours shown in the footer.
  workingHours: Record<WeekDay, DayHours>
  // Floating contact button configuration.
  widget: ContactWidget
}
// SEO configuration: canonical domain, meta tags for Google, Search Console
// verification and a global indexing switch. Filled in by the setup wizard
// and editable later in Настройки → SEO.
export type SeoSettings = {
  /** Canonical public origin, e.g. https://mystore.com. Empty = use env/auto. */
  siteUrl: string
  metaTitle: string
  metaDescription: string
  keywords: string
  /** Content of the google-site-verification meta tag (Search Console). */
  googleVerification: string
  /** When false the whole site is served with noindex (pre-launch mode). */
  indexingEnabled: boolean
}

// Уведомления о событиях магазина: письмо покупателю, письмо и Telegram
// админу при новом заказе. Настраивается в Настройки → Уведомления.
export type NotificationSettings = {
  /** Send order confirmation email to the customer (requires SMTP). */
  customerEmailEnabled: boolean
  /** Send new-order email to the admin (requires SMTP). */
  adminEmailEnabled: boolean
  /** Admin email address for order alerts. Empty = fall back to SMTP user. */
  adminEmail: string
  /** Send new-order alerts to Telegram. */
  telegramEnabled: boolean
  /** Bot token from @BotFather. */
  telegramBotToken: string
  /** Chat ID (personal or group) that receives alerts. */
  telegramChatId: string
}

// Вход через Google (OAuth 2.0). Ключи создаются в Google Cloud Console и
// хранятся в БД; настраивается в Настройки → Вход через Google.
export type GoogleAuthSettings = {
  enabled: boolean
  clientId: string
  clientSecret: string
}

// Hero-блок главной страницы (бейдж, заголовок, текст, кнопка, картинка).
// Настраивается в Настройки → Главная страница. Пустая строка = использовать
// встроенный текст по умолчанию для соответствующего языка, поэтому свежая
// установка выглядит как раньше, пока админ ничего не менял.
export type HomeHeroLocaleContent = {
  badge: string
  title: string
  text: string
  buttonText: string
}

export type HomeHeroSettings = {
  /** URL картинки hero-блока. Пусто = стандартная /hero-electronics.png. */
  imageUrl: string
  uk: HomeHeroLocaleContent
  ru: HomeHeroLocaleContent
}

export type StoreSettingsData = {
  storeName: string
  storeDescription: string | null
  logoUrl: string | null
  faviconUrl: string | null
  openCartAfterAdd: boolean
  defaultLocale: string
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
    /** GA4 (Google Analytics) — separate from the Ads conversion pixel above. */
    gaEnabled: boolean
    gaMeasurementId: string
    /**
     * Enhanced Conversions: sends the buyer's (hashed, client-side by
     * gtag.js) email/phone alongside the purchase conversion so Google can
     * match it to signed-in accounts — recovers conversions lost to
     * cookie/ITP restrictions and improves Smart Bidding. Off by default;
     * admin opts in explicitly since it involves sending PII to Google.
     */
    enhancedConversionsEnabled: boolean
  }
  merchantFeed: {
    /** Google's product taxonomy ID/name, e.g. "Electronics > ...". Sent as
     *  g:google_product_category on every feed item when set — omitting it
     *  risks Shopping listings being limited or disapproved. Blank = omit
     *  the tag entirely (no behavior change from before this field existed). */
    googleProductCategory: string
    /** Flat shipping price shown in the feed (g:shipping), e.g. "60 UAH".
     *  Blank = omit the tag (Merchant Center falls back to whatever
     *  shipping settings exist directly in the Merchant Center account). */
    shippingPrice: string
    /** ISO 3166-1 alpha-2 country the shippingPrice applies to, e.g. "UA". */
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
    /** DKIM selector (e.g. "mail"). Empty = SMTP provider signs the mail. */
    dkimSelector: string
    /** PEM private key for DKIM signing. Prefer the DKIM_PRIVATE_KEY env var. */
    dkimPrivateKey: string
    enabled: boolean
  }
  contact: ContactData
  notifications: NotificationSettings
  googleAuth: GoogleAuthSettings
  homeHero: HomeHeroSettings
}

export const DEFAULTS: StoreSettingsData = {
  storeName: 'Мой магазин',
  storeDescription: '',
  logoUrl: null,
  faviconUrl: null,
  openCartAfterAdd: true,
  defaultLocale: 'uk',
  activeTemplate: 'classic',
  seo: {
    siteUrl: '',
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    googleVerification: '',
    indexingEnabled: true,
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
    smtpHost: '',
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
  },
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

// Read on every page (layout, metadata, home) but changes rarely — cache the
// single-row read across requests and bust it via tag when settings are saved.
export const readSettingsRow = unstable_cache(
  async () => {
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1)
    return row ?? null
  },
  ['store-settings-row'],
  { tags: [STORE_SETTINGS_TAG], revalidate: 3600 },
)

// Full settings including real secrets (SMTP password, DKIM key, Telegram
// bot token, Google OAuth client secret). Server-side use only — see the
// file header. Never import this into a 'use client' component.
export async function getStoreSettingsInternal(): Promise<StoreSettingsData> {
  const row = await readSettingsRow()
  if (!row) return DEFAULTS
  return {
    storeName: row.storeName,
    storeDescription: row.storeDescription,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    openCartAfterAdd: row.openCartAfterAdd,
    defaultLocale: row.defaultLocale ?? 'uk',
    activeTemplate: row.activeTemplate ?? 'classic',
    seo: { ...DEFAULTS.seo, ...(row.seo as Partial<SeoSettings> | null) },
    social: { ...DEFAULTS.social, ...(row.social as StoreSettingsData['social']) },
    googleAds: { ...DEFAULTS.googleAds, ...(row.googleAds as StoreSettingsData['googleAds']) },
    merchantFeed: {
      ...DEFAULTS.merchantFeed,
      ...((row.merchantFeed ?? {}) as Partial<StoreSettingsData['merchantFeed']>),
    },
    emailSettings: {
      ...DEFAULTS.emailSettings,
      ...(row.emailSettings as StoreSettingsData['emailSettings']),
    },
    contact: mergeContact(row.contact as Partial<ContactData> | null),
    notifications: {
      ...DEFAULTS.notifications,
      ...((row.notifications ?? {}) as Partial<NotificationSettings>),
    },
    googleAuth: {
      ...DEFAULTS.googleAuth,
      ...((row.googleAuth ?? {}) as Partial<GoogleAuthSettings>),
    },
    homeHero: mergeHomeHero(row.homeHero as Partial<HomeHeroSettings> | null),
  }
}

// Deep-merge stored hero content over defaults so partially saved objects
// (e.g. only the uk block filled) always resolve to a complete shape.
function mergeHomeHero(stored: Partial<HomeHeroSettings> | null | undefined): HomeHeroSettings {
  if (!stored) return DEFAULTS.homeHero
  return {
    imageUrl: stored.imageUrl ?? '',
    uk: { ...DEFAULTS.homeHero.uk, ...(stored.uk ?? {}) },
    ru: { ...DEFAULTS.homeHero.ru, ...(stored.ru ?? {}) },
  }
}

// Deep-merge stored contact info over defaults so missing keys (e.g. a day that
// was never saved) always resolve to a valid shape.
function mergeContact(stored: Partial<ContactData> | null): ContactData {
  if (!stored) return DEFAULTS.contact
  const wh = { ...DEFAULTS.contact.workingHours }
  if (stored.workingHours) {
    for (const day of Object.keys(wh) as WeekDay[]) {
      if (stored.workingHours[day]) wh[day] = { ...wh[day], ...stored.workingHours[day] }
    }
  }
  // Deep-merge widget channels so a partially-saved widget still resolves to a
  // valid shape with all five channels present.
  const channels = { ...DEFAULTS.contact.widget.channels }
  if (stored.widget?.channels) {
    for (const key of Object.keys(channels) as WidgetChannelKey[]) {
      if (stored.widget.channels[key]) {
        channels[key] = { ...channels[key], ...stored.widget.channels[key] }
      }
    }
  }
  return {
    phones: Array.isArray(stored.phones) && stored.phones.length ? stored.phones : DEFAULTS.contact.phones,
    address: stored.address ?? DEFAULTS.contact.address,
    workingHours: wh,
    widget: {
      enabled: stored.widget?.enabled ?? DEFAULTS.contact.widget.enabled,
      channels,
    },
  }
}

// Public-safe projection: never includes SMTP password, DKIM private key,
// Telegram bot token/chat id, or the Google OAuth client secret.
export function stripSecrets(s: StoreSettingsData): StoreSettingsData {
  return {
    ...s,
    emailSettings: { ...s.emailSettings, smtpUser: '', smtpPassword: '', dkimPrivateKey: '' },
    notifications: { ...s.notifications, telegramBotToken: '', telegramChatId: '' },
    googleAuth: { ...s.googleAuth, clientSecret: '' },
  }
}
