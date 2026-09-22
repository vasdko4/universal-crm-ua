import { describe, expect, it } from 'vitest'
import {
  DEFAULTS,
  normalizeStoreSettingsRow,
  stripSecrets,
} from '@/lib/store-settings-normalize'

describe('normalizeStoreSettingsRow', () => {
  it('returns defaults for null / empty / non-object rows', () => {
    expect(normalizeStoreSettingsRow(null)).toEqual(DEFAULTS)
    expect(normalizeStoreSettingsRow(undefined)).toEqual(DEFAULTS)
    expect(normalizeStoreSettingsRow('oops')).toEqual(DEFAULTS)
    expect(normalizeStoreSettingsRow([])).toEqual(DEFAULTS)
  })

  it('fills missing columns from a live SELECT * that predates later ALTERs', () => {
    const row = {
      id: 1,
      store_name: 'Techno',
      store_description: null,
      logo_url: null,
      favicon_url: null,
      open_cart_after_add: true,
      default_locale: 'uk',
      active_template: 'classic',
      social: {},
      google_ads: {},
      email_settings: {},
      contact: {},
      seo: {},
      notifications: {},
      google_auth: {},
      home_hero: {},
      home_benefits: {},
    }
    const s = normalizeStoreSettingsRow(row)
    expect(s.storeName).toBe('Techno')
    expect(s.localePromptMode).toBe('browser')
    expect(s.storefrontCacheEnabled).toBe(false)
    expect(s.minOrder).toEqual({ enabled: false, amount: 0 })
    expect(s.merchantFeed.shippingCountry).toBe('UA')
    expect(s.contact.widget.channels.telegram).toEqual({ value: '', enabled: false })
    expect(s.homeBenefits.uk).toHaveLength(4)
    expect(s.googleAds.enhancedConversionsEnabled).toBe(false)
  })

  it('does not throw when jsonb columns are strings, arrays, or null', () => {
    const s = normalizeStoreSettingsRow({
      storeName: 'Live',
      social: 'instagram.com/x',
      googleAds: ['bad'],
      emailSettings: null,
      contact: 'phone',
      seo: 12,
      notifications: false,
      googleAuth: null,
      homeHero: 'hero',
      homeBenefits: [],
      minOrder: '500',
      merchantFeed: null,
    })
    expect(s.storeName).toBe('Live')
    expect(s.social.instagram).toEqual({ url: '', enabled: false })
    expect(s.googleAds.enabled).toBe(false)
    expect(s.contact.phones).toEqual([''])
    expect(s.homeHero.slides).toEqual([])
    expect(s.homeBenefits.uk[0].title).toBe(DEFAULTS.homeBenefits.uk[0].title)
    expect(s.minOrder).toEqual({ enabled: false, amount: 0 })
  })

  it('deep-merges a partial contact widget without dropping channels', () => {
    const s = normalizeStoreSettingsRow({
      contact: {
        phones: ['+380501112233'],
        widget: { enabled: true, channels: { telegram: { value: '@shop', enabled: true } } },
      },
    })
    expect(s.contact.phones).toEqual(['+380501112233'])
    expect(s.contact.widget.enabled).toBe(true)
    expect(s.contact.widget.channels.telegram).toEqual({ value: '@shop', enabled: true })
    expect(s.contact.widget.channels.phone).toEqual({ value: '', enabled: false })
    expect(s.contact.workingHours.sun.closed).toBe(true)
  })

  it('accepts locale_prompt_mode modal from snake_case', () => {
    const s = normalizeStoreSettingsRow({ locale_prompt_mode: 'modal' })
    expect(s.localePromptMode).toBe('modal')
  })

  it('accepts storefront_cache_enabled from snake_case', () => {
    const s = normalizeStoreSettingsRow({ storefront_cache_enabled: true })
    expect(s.storefrontCacheEnabled).toBe(true)
  })
})

describe('stripSecrets', () => {
  it('clears SMTP / DKIM / Telegram / Google secret fields', () => {
    const full = normalizeStoreSettingsRow({
      email_settings: { smtpUser: 'a', smtpPassword: 'b', dkimPrivateKey: 'c' },
      notifications: { telegramBotToken: 't', telegramChatId: '1' },
      google_auth: { clientSecret: 's', clientId: 'id', enabled: true },
    })
    const publicShape = stripSecrets(full)
    expect(publicShape.emailSettings.smtpPassword).toBe('')
    expect(publicShape.emailSettings.dkimPrivateKey).toBe('')
    expect(publicShape.notifications.telegramBotToken).toBe('')
    expect(publicShape.googleAuth.clientSecret).toBe('')
    expect(publicShape.googleAuth.clientId).toBe('id')
  })
})
