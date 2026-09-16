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
import { unstable_cache } from 'next/cache'
import { pool } from '@/lib/db'
import {
  DEFAULTS,
  normalizeStoreSettingsRow,
  type StoreSettingsData,
} from '@/lib/store-settings-normalize'

export const STORE_SETTINGS_TAG = 'store-settings'

export {
  DEFAULTS,
  normalizeStoreSettingsRow,
  stripSecrets,
  mergeContact,
  mergeHomeHero,
  mergeHomeBenefits,
} from '@/lib/store-settings-normalize'

export type {
  SocialLink,
  DayHours,
  WeekDay,
  WidgetChannelKey,
  WidgetChannel,
  ContactWidget,
  ContactData,
  SeoSettings,
  NotificationSettings,
  GoogleAuthSettings,
  HomeHeroLocaleContent,
  HomeHeroSlideLocale,
  HomeHeroSlide,
  HomeHeroSettings,
  HomeBenefitItem,
  HomeBenefitsSettings,
  MinOrderSettings,
  StoreSettingsData,
} from '@/lib/store-settings-normalize'

// Read on every page (layout, metadata, home) but changes rarely — cache the
// single-row read across requests and bust it via tag when settings are saved.
//
// SELECT * (not drizzle select()) so a live DB that has not yet applied a
// later ALTER (locale_prompt_mode, min_order, …) still returns a row instead
// of 500ing the admin settings page. Missing keys become DEFAULTS in
// normalizeStoreSettingsRow().
export const readSettingsRow = unstable_cache(
  async (): Promise<Record<string, unknown> | null> => {
    try {
      const { rows } = await pool.query('SELECT * FROM store_settings WHERE id = 1 LIMIT 1')
      return (rows[0] as Record<string, unknown> | undefined) ?? null
    } catch (err) {
      console.error('[store-settings] readSettingsRow failed:', (err as Error).message)
      return null
    }
  },
  ['store-settings-row'],
  { tags: [STORE_SETTINGS_TAG], revalidate: 3600 },
)

// Full settings including real secrets (SMTP password, DKIM key, Telegram
// bot token, Google OAuth client secret). Server-side use only — see the
// file header. Never import this into a 'use client' component.
export async function getStoreSettingsInternal(): Promise<StoreSettingsData> {
  try {
    const row = await readSettingsRow()
    return normalizeStoreSettingsRow(row)
  } catch (err) {
    console.error('[store-settings] getStoreSettingsInternal failed:', (err as Error).message)
    return DEFAULTS
  }
}
