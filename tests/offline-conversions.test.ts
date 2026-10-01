import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash } from 'node:crypto'

// reportError pulls in lib/store-settings (next/cache, db) at import time —
// mock it like tests/server-errors.test.ts does. Our code never sets
// alertAdmin, so the mock is never actually called.
vi.mock('@/lib/store-settings', () => ({
  getStoreSettingsInternal: vi.fn(),
}))

import {
  getAdsCredentials,
  isOfflineConversionsConfigured,
  buildClickConversion,
  formatConversionDateTime,
  normalizeEmailForHash,
  normalizePhoneForHash,
  sha256Hex,
  uploadOfflineConversion,
} from '@/lib/ads/offline-conversions'

const ENV_KEYS = [
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID',
  'GOOGLE_ADS_CONVERSION_ACTION_ID',
] as const

const savedEnv: Record<string, string | undefined> = {}
let errSpy: ReturnType<typeof vi.spyOn>

function setCreds(overrides: Record<string, string> = {}) {
  for (const k of ENV_KEYS) delete process.env[k]
  Object.assign(process.env, {
    GOOGLE_ADS_DEVELOPER_TOKEN: 'dev-token',
    GOOGLE_ADS_CLIENT_ID: 'client-id',
    GOOGLE_ADS_CLIENT_SECRET: 'client-secret',
    GOOGLE_ADS_REFRESH_TOKEN: 'refresh-token',
    GOOGLE_ADS_CUSTOMER_ID: '123-456-7890',
    GOOGLE_ADS_CONVERSION_ACTION_ID: '987654321',
    ...overrides,
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('getAdsCredentials', () => {
  it('returns null when nothing is configured', () => {
    expect(getAdsCredentials()).toBeNull()
    expect(isOfflineConversionsConfigured()).toBe(false)
  })

  it('returns null when any single variable is missing', () => {
    setCreds({ GOOGLE_ADS_REFRESH_TOKEN: '' })
    expect(getAdsCredentials()).toBeNull()
  })

  it('parses credentials and strips dashes from the customer id', () => {
    setCreds()
    expect(getAdsCredentials()).toEqual({
      developerToken: 'dev-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token',
      customerId: '1234567890',
      conversionActionId: '987654321',
    })
    expect(isOfflineConversionsConfigured()).toBe(true)
  })
})

describe('normalization', () => {
  it('email: lowercase + trim, like the client-side gtag user_data', () => {
    expect(normalizeEmailForHash('  Test@Example.COM ')).toBe('test@example.com')
  })

  it('phone: Ukrainian local 0XXXXXXXXX becomes +380XXXXXXXXX', () => {
    expect(normalizePhoneForHash('067 123-45-67')).toBe('+380671234567')
  })

  it('phone: keeps an existing + prefix', () => {
    expect(normalizePhoneForHash('+380671234567')).toBe('+380671234567')
  })

  it('sha256Hex matches node crypto', () => {
    expect(sha256Hex('test@example.com')).toBe(
      createHash('sha256').update('test@example.com', 'utf8').digest('hex'),
    )
  })
})

describe('formatConversionDateTime', () => {
  it('produces YYYY-MM-DD HH:MM:SS±HH:MM in Europe/Kyiv', () => {
    // 2026-10-01 12:00 UTC = 15:00 in Kyiv (EEST, +03:00).
    const out = formatConversionDateTime(new Date('2026-10-01T12:00:00Z'))
    expect(out).toBe('2026-10-01 15:00:00+03:00')
  })

  it('handles winter offset (+02:00)', () => {
    const out = formatConversionDateTime(new Date('2026-01-15T12:00:00Z'))
    expect(out).toBe('2026-01-15 14:00:00+02:00')
  })
})

describe('buildClickConversion', () => {
  const creds = {
    developerToken: 'dev-token',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    refreshToken: 'refresh-token',
    customerId: '1234567890',
    conversionActionId: '987654321',
  }

  it('builds the payload with orderNumber as order_id, value and currency', () => {
    const c = buildClickConversion(
      {
        orderNumber: 'UA-2026-000123',
        value: 1234.567,
        currency: 'uah',
        email: 'buyer@example.com',
        phone: '0671234567',
        conversionDate: new Date('2026-10-01T12:00:00Z'),
      },
      creds,
    )
    expect(c.orderId).toBe('UA-2026-000123')
    expect(c.conversionValue).toBe(1234.57) // rounded to 2 decimals, no float dust
    expect(c.currencyCode).toBe('UAH')
    expect(c.conversionAction).toBe('customers/1234567890/conversionActions/987654321')
    expect(c.conversionDateTime).toBe('2026-10-01 15:00:00+03:00')
    expect(c.userIdentifiers).toHaveLength(2)
    expect(c.userIdentifiers![0].hashedEmail).toBe(sha256Hex('buyer@example.com'))
    expect(c.userIdentifiers![1].hashedPhoneNumber).toBe(sha256Hex('+380671234567'))
  })

  it('omits userIdentifiers when email/phone are absent and defaults currency to UAH', () => {
    const c = buildClickConversion({ orderNumber: 'UA-1', value: 100 }, creds)
    expect(c.userIdentifiers).toBeUndefined()
    expect(c.currencyCode).toBe('UAH')
  })

  it('never includes plaintext email/phone in the payload', () => {
    const c = buildClickConversion(
      { orderNumber: 'UA-1', value: 100, email: 'Buyer@Example.com', phone: '0671234567' },
      creds,
    )
    expect(JSON.stringify(c)).not.toContain('Buyer@Example.com')
    expect(JSON.stringify(c)).not.toContain('0671234567')
  })
})

describe('uploadOfflineConversion', () => {
  it('is a silent no-op when credentials are missing: no fetch, no logging', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const res = await uploadOfflineConversion({ orderNumber: 'UA-1', value: 100 })
    expect(res).toEqual({ ok: true, skipped: true })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
  })

  it('uploads via the token + uploadClickConversions endpoints on success', async () => {
    setCreds()
    const fetchSpy = vi.fn(async (url: string | URL) => {
      const u = String(url)
      if (u.includes('oauth2.googleapis.com')) {
        return jsonResponse({ access_token: 'ya29.test' })
      }
      return jsonResponse({
        results: [{ conversionAction: 'customers/1234567890/conversionActions/987654321' }],
      })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await uploadOfflineConversion({
      orderNumber: 'UA-2026-000123',
      value: 1500,
      currency: 'UAH',
      email: 'buyer@example.com',
    })

    expect(res).toEqual({ ok: true, skipped: false })
    expect(fetchSpy).toHaveBeenCalledTimes(2)

    const [uploadUrl, uploadInit] = fetchSpy.mock.calls[1] as [string, RequestInit]
    expect(uploadUrl).toBe(
      'https://googleads.googleapis.com/v25/customers/1234567890:uploadClickConversions',
    )
    const headers = uploadInit.headers as Record<string, string>
    expect(headers['developer-token']).toBe('dev-token')
    expect(headers['Authorization']).toBe('Bearer ya29.test')
    const body = JSON.parse(String(uploadInit.body))
    expect(body.partialFailure).toBe(true)
    expect(body.conversions).toHaveLength(1)
    expect(body.conversions[0].orderId).toBe('UA-2026-000123')
    expect(body.conversions[0].conversionValue).toBe(1500)
    expect(body.conversions[0].currencyCode).toBe('UAH')
    expect(body.conversions[0].userIdentifiers[0].hashedEmail).toBe(
      sha256Hex('buyer@example.com'),
    )
    expect(errSpy).not.toHaveBeenCalled()
  })

  it('reports OAuth failures via reportError and never throws', async () => {
    setCreds()
    const fetchSpy = vi.fn(async () => new Response('bad', { status: 500 }))
    vi.stubGlobal('fetch', fetchSpy)

    const res = await uploadOfflineConversion({ orderNumber: 'UA-1', value: 100 })
    expect(res).toEqual({ ok: false, skipped: false })
    // Only the token call happened — no upload attempt.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0][0])).toContain('oauth2.googleapis.com')
    // reportError wrote its structured line (tag + order number, no secrets).
    expect(errSpy).toHaveBeenCalledTimes(1)
    const line = JSON.parse(String(errSpy.mock.calls[0][0]))
    expect(line.tag).toBe('ads.offlineConversion')
    expect(line.gateway).toBe('google-ads')
    expect(line.reason).toContain('UA-1')
  })

  it('treats a failed upload request as a logged failure', async () => {
    setCreds()
    const fetchSpy = vi.fn(async (url: string | URL) =>
      String(url).includes('oauth2.googleapis.com')
        ? jsonResponse({ access_token: 'ya29.test' })
        : new Response('denied', { status: 403 }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const res = await uploadOfflineConversion({ orderNumber: 'UA-2', value: 50 })
    expect(res).toEqual({ ok: false, skipped: false })
    expect(errSpy).toHaveBeenCalledTimes(1)
  })

  it('treats partialFailureError as a logged failure', async () => {
    setCreds()
    const fetchSpy = vi.fn(async (url: string | URL) =>
      String(url).includes('oauth2.googleapis.com')
        ? jsonResponse({ access_token: 'ya29.test' })
        : jsonResponse({
            results: [],
            partialFailureError: { message: 'CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE' },
          }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const res = await uploadOfflineConversion({ orderNumber: 'UA-3', value: 50 })
    expect(res).toEqual({ ok: false, skipped: false })
    expect(errSpy).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid input without touching the network', async () => {
    setCreds()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await uploadOfflineConversion({ orderNumber: '  ', value: 100 })).toEqual({
      ok: false,
      skipped: false,
    })
    expect(await uploadOfflineConversion({ orderNumber: 'UA-4', value: Number.NaN })).toEqual({
      ok: false,
      skipped: false,
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalledTimes(2)
  })
})
