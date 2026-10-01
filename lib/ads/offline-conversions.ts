/**
 * Server-side Google Ads offline conversion uploads.
 *
 * The client-side gtag `purchase` conversion (components/shop/google-ads.tsx)
 * never fires for a meaningful share of paid orders — ad blockers, ITP,
 * closed tabs. This module re-sends the conversion through the Google Ads API
 * (`ConversionUploadService.UploadClickConversions`) keyed by `order_id`
 * (= our orderNumber), so paid orders are counted even when the pixel died.
 * Google dedups on (conversion action, order_id), so a client-side hit and a
 * server-side hit for the same order count once.
 *
 * We do not capture the click id (gclid), so the upload goes the
 * "Enhanced Conversions for leads" route: SHA-256-hashed email/phone in
 * `user_identifiers`. The conversion action therefore needs
 * "Enhanced conversions for leads" enabled in the Google Ads UI
 * (Goals → Summary → the action → Enhanced conversions).
 *
 * Pure REST — no google-ads npm dependency. OAuth2 via refresh token
 * (scope https://www.googleapis.com/auth/adwords).
 *
 * Best-effort by design: uploadOfflineConversion never throws. Failures are
 * reported through reportError() and surfaced as { ok: false } so callers
 * (payment settlement) can never break checkout over an Ads outage.
 */
import { createHash } from 'node:crypto'
import { fetchWithTimeout } from '@/lib/http'
import { reportError } from '@/lib/server-errors'

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// v21 was sunset 2026-08-05; v25 is current (checked 2026-10-01). Bump this
// constant when Google sunsets it — a dead version answers UNSUPPORTED_VERSION.
const ADS_API_VERSION = 'v25'
// The store's reporting timezone: conversion_date_time must carry the
// account-timezone offset, and all shop dates are Europe/Kyiv.
const SHOP_TIMEZONE = 'Europe/Kyiv'

export type OfflineConversionInput = {
  /** Our order number — becomes Google's order_id (dedup key). */
  orderNumber: string
  /** Order total in currency units (e.g. 1234.50). Rounded to 2 decimals. */
  value: number
  /** ISO 4217, defaults to 'UAH'. */
  currency?: string
  /** Plaintext; normalized + SHA-256-hashed before sending (never raw). */
  email?: string | null
  phone?: string | null
  /** Conversion moment; defaults to now. Overridable for tests. */
  conversionDate?: Date
}

export type OfflineConversionResult = {
  ok: boolean
  /** True when GOOGLE_ADS_* env vars are missing — silently skipped. */
  skipped: boolean
}

type AdsCredentials = {
  developerToken: string
  clientId: string
  clientSecret: string
  refreshToken: string
  /** Digits only, no dashes. */
  customerId: string
  conversionActionId: string
}

function env(name: string): string | undefined {
  const v = process.env[name]?.trim()
  return v ? v : undefined
}

/** Null when the integration is not configured — callers treat it as no-op. */
export function getAdsCredentials(): AdsCredentials | null {
  const developerToken = env('GOOGLE_ADS_DEVELOPER_TOKEN')
  const clientId = env('GOOGLE_ADS_CLIENT_ID')
  const clientSecret = env('GOOGLE_ADS_CLIENT_SECRET')
  const refreshToken = env('GOOGLE_ADS_REFRESH_TOKEN')
  const customerId = env('GOOGLE_ADS_CUSTOMER_ID')?.replace(/-/g, '')
  const conversionActionId = env('GOOGLE_ADS_CONVERSION_ACTION_ID')
  if (
    !developerToken ||
    !clientId ||
    !clientSecret ||
    !refreshToken ||
    !customerId ||
    !conversionActionId
  ) {
    return null
  }
  return { developerToken, clientId, clientSecret, refreshToken, customerId, conversionActionId }
}

export function isOfflineConversionsConfigured(): boolean {
  return getAdsCredentials() !== null
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

// Normalization mirrors the client-side gtag user_data normalization in
// components/shop/google-ads.tsx so hashes match Google's expectations:
// lowercase + trim for email, digits-only E.164-ish for phone (Ukrainian
// local numbers 0XXXXXXXXX become +380XXXXXXXXX).
export function normalizeEmailForHash(email: string): string {
  return email.trim().toLowerCase()
}

export function normalizePhoneForHash(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0')) return `+38${digits}`
  return `+${digits}`
}

// "YYYY-MM-DD HH:MM:SS±HH:MM" in the shop timezone — the format the
// conversionDateTime field requires. Offset is computed from the wall-clock
// difference for the given instant so DST is handled automatically.
export function formatConversionDateTime(date: Date): string {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]))
  // hour can come back as "24" at midnight with hour12:false — normalize.
  const hour = Number(parts.hour) % 24
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  )
  const offsetMinutes = Math.round((wallAsUtc - date.getTime()) / 60000)
  const sign = offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(offsetMinutes)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${parts.year}-${parts.month}-${parts.day} ${pad(hour)}:${parts.minute}:${parts.second}`
  return `${stamp}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

export type ClickConversionPayload = {
  conversionAction: string
  conversionDateTime: string
  orderId: string
  conversionValue: number
  currencyCode: string
  userIdentifiers?: Array<{ hashedEmail?: string; hashedPhoneNumber?: string }>
}

/** Pure payload builder — unit-testable without credentials or network. */
export function buildClickConversion(
  input: OfflineConversionInput,
  creds: AdsCredentials,
): ClickConversionPayload {
  const userIdentifiers: Array<{ hashedEmail?: string; hashedPhoneNumber?: string }> = []
  const email = input.email?.trim()
  if (email) {
    userIdentifiers.push({ hashedEmail: sha256Hex(normalizeEmailForHash(email)) })
  }
  const phone = input.phone?.trim()
  if (phone) {
    userIdentifiers.push({ hashedPhoneNumber: sha256Hex(normalizePhoneForHash(phone)) })
  }
  // conversionValue is a wire double per the API; round from the stored
  // decimal so float dust (1234.4999999) never reaches Google.
  const conversionValue = Math.round(input.value * 100) / 100
  return {
    conversionAction: `customers/${creds.customerId}/conversionActions/${creds.conversionActionId}`,
    conversionDateTime: formatConversionDateTime(input.conversionDate ?? new Date()),
    orderId: input.orderNumber.trim(),
    conversionValue,
    currencyCode: (input.currency?.trim() || 'UAH').toUpperCase(),
    ...(userIdentifiers.length > 0 ? { userIdentifiers } : {}),
  }
}

async function fetchAccessToken(creds: AdsCredentials): Promise<string> {
  const res = await fetchWithTimeout(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
    }).toString(),
    timeoutMs: 10_000,
    label: 'google-ads-oauth',
  })
  if (!res.ok) {
    throw new Error(`oauth token request failed with status ${res.status}`)
  }
  const data = (await res.json()) as { access_token?: unknown }
  if (typeof data?.access_token !== 'string' || !data.access_token) {
    throw new Error('oauth token response missing access_token')
  }
  return data.access_token
}

/**
 * Uploads one paid order as an offline conversion. Never throws:
 * - unconfigured credentials → silent no-op { ok: true, skipped: true }
 * - any network/API failure → reportError() + { ok: false, skipped: false }
 */
export async function uploadOfflineConversion(
  input: OfflineConversionInput,
): Promise<OfflineConversionResult> {
  const creds = getAdsCredentials()
  if (!creds) return { ok: true, skipped: true }

  try {
    if (!input.orderNumber?.trim()) {
      throw new Error('orderNumber is required')
    }
    if (!Number.isFinite(input.value) || input.value < 0) {
      throw new Error('value must be a finite non-negative number')
    }

    const accessToken = await fetchAccessToken(creds)
    const conversion = buildClickConversion(input, creds)
    const res = await fetchWithTimeout(
      `https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${creds.customerId}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'developer-token': creds.developerToken,
        },
        body: JSON.stringify({ conversions: [conversion], partialFailure: true }),
        timeoutMs: 15_000,
        label: 'google-ads-upload-click-conversions',
      },
    )
    if (!res.ok) {
      throw new Error(`upload request failed with status ${res.status}`)
    }
    const data = (await res.json()) as {
      results?: unknown[]
      partialFailureError?: { message?: string } | null
    }
    if (data?.partialFailureError) {
      throw new Error(`upload partially failed: ${data.partialFailureError.message ?? 'unknown'}`)
    }
    if (!Array.isArray(data?.results) || data.results.length === 0) {
      throw new Error('upload returned no results')
    }
    return { ok: true, skipped: false }
  } catch (error) {
    // Best-effort: an Ads outage must never break payment settlement.
    // reportError never throws and strips exception details (they may
    // contain credentials); context carries only the order number.
    await reportError('ads.offlineConversion', error, {
      context: { gateway: 'google-ads', reason: `order ${input.orderNumber}`.slice(0, 60) },
    })
    return { ok: false, skipped: false }
  }
}
