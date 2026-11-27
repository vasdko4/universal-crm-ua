import { describe, expect, it } from 'vitest'
import {
  normalizeStoreSettingsRow,
  projectPublicStoreSettings,
  type StoreSettingsData,
} from '@/lib/store-settings-normalize'

// Full internal row, every secret / admin-only field populated with a
// distinctive sentinel so a leak is visible in a serialized dump.
function fullSettings(): StoreSettingsData {
  return normalizeStoreSettingsRow({
    store_name: 'PowerFox',
    store_description: 'Магазин техніки',
    logo_url: 'https://cdn.example/logo.png',
    favicon_url: 'https://cdn.example/favicon.ico',
    open_cart_after_add: true,
    storefront_cache_enabled: true,
    session_binding_enabled: true,
    default_locale: 'uk',
    locale_prompt_mode: 'modal',
    active_template: 'modern',
    admin_theme: 'violet',
    seo: {
      siteUrl: 'https://powerfox.shop',
      metaTitle: 'PowerFox — техніка',
      metaDescription: 'Опис',
      keywords: 'техніка',
      googleVerification: 'GOOGLE-VERIFY-TOKEN',
      indexingEnabled: true,
      ogImageUrl: 'https://cdn.example/og.png',
    },
    social: {
      instagram: { url: 'https://instagram.com/powerfox', enabled: true },
      telegram: { url: 'https://t.me/powerfox', enabled: true },
      viber: { url: 'viber://chat?number=380', enabled: false },
      tiktok: { url: '', enabled: false },
    },
    google_ads: {
      conversionId: 'AW-123456789',
      conversionLabel: 'AbC123',
      enabled: true,
      gaEnabled: true,
      gaMeasurementId: 'G-ABCDEFGH',
      enhancedConversionsEnabled: true,
    },
    merchant_feed: {
      googleProductCategory: 'MERCHANT-CAT-SECRET',
      shippingPrice: '999',
      shippingCountry: 'UA',
    },
    email_settings: {
      provider: 'smtp',
      fromEmail: 'noreply@powerfox.shop',
      fromName: 'PowerFox',
      smtpHost: 'SMTP-HOST-SECRET',
      smtpPort: '465',
      smtpUser: 'SMTP-USER-SECRET',
      smtpPassword: 'SMTP-PASS-SECRET',
      dkimSelector: 'DKIM-SELECTOR-SECRET',
      dkimPrivateKey: 'DKIM-KEY-SECRET',
      enabled: true,
    },
    contact: {
      phones: ['+380501112233'],
      address: 'вул. Левицького, 58',
      workingHours: { mon: { open: '08:00', close: '20:00', closed: false } },
      widget: { enabled: true, channels: { email: { value: 'support@powerfox.shop', enabled: true } } },
    },
    notifications: {
      customerEmailEnabled: true,
      adminEmailEnabled: true,
      adminEmail: 'ADMIN-EMAIL-SECRET@example.com',
      telegramEnabled: true,
      telegramBotToken: 'TG-TOKEN-SECRET',
      telegramChatId: 'TG-CHAT-SECRET',
    },
    google_auth: { enabled: true, clientId: 'GOOGLE-CLIENTID-SECRET', clientSecret: 'GOOGLE-SECRET-SECRET' },
    home_hero: {
      imageUrl: 'https://cdn.example/hero.png',
      uk: { badge: 'Акція', title: 'Заголовок', text: 'Текст', buttonText: 'Купити' },
      ru: { badge: 'Акция', title: 'Заголовок', text: 'Текст', buttonText: 'Купить' },
      slides: [
        {
          image: 'https://cdn.example/slide.png',
          href: '/catalog',
          uk: { badge: 'B', title: 'T', text: 'X', cta: 'C' },
          ru: { badge: 'B', title: 'T', text: 'X', cta: 'C' },
        },
      ],
    },
    home_benefits: {
      uk: [{ title: 'Доставка', text: 'Швидко', iconUrl: 'https://cdn.example/i.png' }],
      ru: [{ title: 'Доставка', text: 'Быстро', iconUrl: 'https://cdn.example/i.png' }],
    },
    min_order: { enabled: true, amount: 500 },
    ads_spend: { entries: [{ source: 'google', medium: 'cpc', campaign: 'Sale', spend: 12345.67 }] },
    prom: {
      enabled: true,
      apiToken: 'PROM-TOKEN-SECRET',
      syncPrices: true,
      syncStock: false,
      syncCharacteristics: true,
      syncIntervalMinutes: 30,
      lastSyncAt: '2026-11-27T00:00:00.000Z',
      lastSyncSummary: 'PROM-SYNC-SUMMARY-SECRET',
    },
  })
}

describe('projectPublicStoreSettings', () => {
  it('returns exactly the allowlisted top-level keys — nothing else', () => {
    const out = projectPublicStoreSettings(fullSettings())
    expect(Object.keys(out).sort()).toEqual(
      [
        'activeTemplate',
        'adminTheme',
        'contact',
        'emailSettings',
        'faviconUrl',
        'googleAds',
        'homeBenefits',
        'homeHero',
        'logoUrl',
        'minOrder',
        'seo',
        'social',
        'storeDescription',
        'storeName',
      ].sort(),
    )
  })

  it('preserves branding, theme and template fields', () => {
    const out = projectPublicStoreSettings(fullSettings())
    expect(out.storeName).toBe('PowerFox')
    expect(out.storeDescription).toBe('Магазин техніки')
    expect(out.logoUrl).toBe('https://cdn.example/logo.png')
    expect(out.faviconUrl).toBe('https://cdn.example/favicon.ico')
    expect(out.activeTemplate).toBe('modern')
    expect(out.adminTheme).toBe('violet')
  })

  it('preserves contact, social and seo in full', () => {
    const out = projectPublicStoreSettings(fullSettings())
    expect(out.contact.phones).toEqual(['+380501112233'])
    expect(out.contact.address).toBe('вул. Левицького, 58')
    expect(out.contact.workingHours.mon).toEqual({ open: '08:00', close: '20:00', closed: false })
    expect(out.contact.widget.enabled).toBe(true)
    expect(out.contact.widget.channels.email).toEqual({ value: 'support@powerfox.shop', enabled: true })
    expect(out.social.instagram).toEqual({ url: 'https://instagram.com/powerfox', enabled: true })
    expect(out.social.telegram).toEqual({ url: 'https://t.me/powerfox', enabled: true })
    expect(out.seo.siteUrl).toBe('https://powerfox.shop')
    expect(out.seo.metaTitle).toBe('PowerFox — техніка')
    expect(out.seo.googleVerification).toBe('GOOGLE-VERIFY-TOKEN')
    expect(out.seo.indexingEnabled).toBe(true)
  })

  it('preserves home hero, home benefits and minOrder', () => {
    const out = projectPublicStoreSettings(fullSettings())
    expect(out.homeHero.imageUrl).toBe('https://cdn.example/hero.png')
    expect(out.homeHero.uk).toEqual({ badge: 'Акція', title: 'Заголовок', text: 'Текст', buttonText: 'Купити' })
    expect(out.homeHero.slides).toHaveLength(1)
    expect(out.homeHero.slides[0].image).toBe('https://cdn.example/slide.png')
    expect(out.homeHero.slides[0].uk.cta).toBe('C')
    expect(out.homeBenefits.uk[0]).toEqual({
      title: 'Доставка',
      text: 'Швидко',
      iconUrl: 'https://cdn.example/i.png',
    })
    expect(out.minOrder).toEqual({ enabled: true, amount: 500 })
  })

  it('preserves googleAds in full (checkout + one-click-buy need it)', () => {
    const out = projectPublicStoreSettings(fullSettings())
    expect(out.googleAds).toEqual({
      conversionId: 'AW-123456789',
      conversionLabel: 'AbC123',
      enabled: true,
      gaEnabled: true,
      gaMeasurementId: 'G-ABCDEFGH',
      enhancedConversionsEnabled: true,
    })
  })

  it('emailSettings exposes only enabled + fromEmail', () => {
    const out = projectPublicStoreSettings(fullSettings())
    expect(Object.keys(out.emailSettings).sort()).toEqual(['enabled', 'fromEmail'])
    expect(out.emailSettings).toEqual({ enabled: true, fromEmail: 'noreply@powerfox.shop' })
  })

  it('leaks no SMTP / DKIM material', () => {
    const out = projectPublicStoreSettings(fullSettings())
    expect(out).not.toHaveProperty('emailSettings.smtpHost')
    expect(out).not.toHaveProperty('emailSettings.smtpPort')
    expect(out).not.toHaveProperty('emailSettings.smtpUser')
    expect(out).not.toHaveProperty('emailSettings.smtpPassword')
    expect(out).not.toHaveProperty('emailSettings.dkimSelector')
    expect(out).not.toHaveProperty('emailSettings.dkimPrivateKey')
    expect(out).not.toHaveProperty('emailSettings.provider')
    const dump = JSON.stringify(out)
    for (const secret of [
      'SMTP-HOST-SECRET',
      'SMTP-USER-SECRET',
      'SMTP-PASS-SECRET',
      'DKIM-SELECTOR-SECRET',
      'DKIM-KEY-SECRET',
    ]) {
      expect(dump).not.toContain(secret)
    }
  })

  it('leaks no Telegram, admin-email or Google OAuth material', () => {
    const out = projectPublicStoreSettings(fullSettings())
    expect(out).not.toHaveProperty('notifications')
    expect(out).not.toHaveProperty('googleAuth')
    const dump = JSON.stringify(out)
    for (const secret of [
      'TG-TOKEN-SECRET',
      'TG-CHAT-SECRET',
      'ADMIN-EMAIL-SECRET@example.com',
      'GOOGLE-CLIENTID-SECRET',
      'GOOGLE-SECRET-SECRET',
    ]) {
      expect(dump).not.toContain(secret)
    }
  })

  it('leaks no Prom, adsSpend, merchantFeed or internal flags — and no unknown input keys', () => {
    const full = fullSettings()
    const out = projectPublicStoreSettings(full)
    expect(out).not.toHaveProperty('prom')
    expect(out).not.toHaveProperty('adsSpend')
    expect(out).not.toHaveProperty('merchantFeed')
    expect(out).not.toHaveProperty('sessionBindingEnabled')
    expect(out).not.toHaveProperty('storefrontCacheEnabled')
    expect(out).not.toHaveProperty('openCartAfterAdd')
    expect(out).not.toHaveProperty('defaultLocale')
    expect(out).not.toHaveProperty('localePromptMode')
    const dump = JSON.stringify(out)
    for (const secret of [
      'PROM-TOKEN-SECRET',
      'PROM-SYNC-SUMMARY-SECRET',
      'MERCHANT-CAT-SECRET',
      '12345.67',
    ]) {
      expect(dump).not.toContain(secret)
    }
    // No spread of the input: unknown keys smuggled into the internal shape
    // must not appear in the projection.
    const smuggled = {
      ...full,
      leakedExtra: 'LEAKED-EXTRA-SECRET',
      emailSettings: { ...full.emailSettings, extraSecret: 'LEAKED-EMAIL-SECRET' },
    } as unknown as StoreSettingsData
    const smuggledDump = JSON.stringify(projectPublicStoreSettings(smuggled))
    expect(smuggledDump).not.toContain('LEAKED-EXTRA-SECRET')
    expect(smuggledDump).not.toContain('LEAKED-EMAIL-SECRET')
    // Output is a copy, not an alias of the internal row.
    out.contact.phones.push('+380999999999')
    expect(full.contact.phones).toEqual(['+380501112233'])
  })
})
