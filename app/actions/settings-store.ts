'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { db } from '@/lib/db'
import { storeSettings } from '@/lib/db/schema'
import { assertPermission } from '@/lib/session'
import {
  STORE_SETTINGS_TAG,
  getStoreSettingsInternal,
  stripSecrets,
  type StoreSettingsData,
} from '@/lib/store-settings'

// Re-export types for existing callers/components that import them from
// this action file.
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
  HomeHeroSettings,
  StoreSettingsData,
} from '@/lib/store-settings'

// Admin-only: full settings including real secrets (SMTP password, DKIM key,
// Telegram bot token, Google OAuth client secret). Used by the admin settings
// page. SECURITY: this used to have no permission check at all, even though
// it's directly reachable as a server action regardless of which page
// imports it — so anyone could call it to read those secrets. Public pages
// and internal system code (mailer, notifications, tracking sync, SEO
// metadata) must use getPublicStoreSettings() or getStoreSettingsInternal()
// (lib/store-settings.ts) instead, neither of which needs this permission.
export async function getStoreSettings(): Promise<StoreSettingsData> {
  await assertPermission('settings')
  return getStoreSettingsInternal()
}

// Public, unauthenticated projection for storefront pages (layout, homepage,
// robots.txt, sign-in, articles, etc.) that only need branding/SEO/contact
// fields — secrets are stripped. Prefer getStoreSettingsInternal() directly
// for server-only library code instead of this, to avoid the extra copy.
export async function getPublicStoreSettings(): Promise<StoreSettingsData> {
  return stripSecrets(await getStoreSettingsInternal())
}

// Shared writer. Not exported directly — the public entrypoint below adds the
// admin permission check. The setup wizard writes settings via direct SQL in
// app/actions/setup.ts, guarded by the fresh-install check there.
async function writeStoreSettings(data: Partial<StoreSettingsData>) {
  const current = await getStoreSettingsInternal()
  const merged = { ...current, ...data }
  const values = {
    storeName: merged.storeName,
    storeDescription: merged.storeDescription,
    logoUrl: merged.logoUrl,
    faviconUrl: merged.faviconUrl,
    openCartAfterAdd: merged.openCartAfterAdd,
    defaultLocale: merged.defaultLocale,
    activeTemplate: merged.activeTemplate,
    seo: merged.seo,
    social: merged.social,
    googleAds: merged.googleAds,
    emailSettings: merged.emailSettings,
    contact: merged.contact,
    notifications: merged.notifications,
    googleAuth: merged.googleAuth,
    homeHero: merged.homeHero,
    updatedAt: new Date(),
  }
  await db
    .insert(storeSettings)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: storeSettings.id, set: values })
  // Google OAuth credentials feed the Better Auth instance — drop its cache so
  // new keys apply without a server restart.
  const { invalidateAuthCache } = await import('@/lib/auth')
  invalidateAuthCache()
  revalidateTag(STORE_SETTINGS_TAG, 'max')
  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateStoreSettings(data: Partial<StoreSettingsData>) {
  const user = await assertPermission('settings')
  // The settings UI keeps one big object in state and always submits it in
  // full on save, so `Object.keys(data)` lists every field regardless of
  // what the admin actually touched. Diff against the current row first so
  // the audit log only names fields whose value really changed.
  const before = await getStoreSettingsInternal()
  const changedKeys = Object.keys(data).filter((key) => {
    const k = key as keyof StoreSettingsData
    return JSON.stringify(before[k]) !== JSON.stringify(data[k])
  })
  const result = await writeStoreSettings(data)
  const { auditLog } = await import('@/lib/audit-log')
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'settings', entity: 'settings',
    details:
      changedKeys.length > 0
        ? `Обновлены настройки: ${changedKeys.join(', ')}`
        : 'Настройки сохранены (без изменений)',
  })
  return result
}

export async function updateAppearance(data: { activeTemplate?: string; defaultLocale?: string }) {
  return updateStoreSettings(data)
}

// Admin "Clear cache" button (Настройки → Система). Busts every server-side
// cache the storefront uses: catalog/category/product/review/checkout query
// caches, the store-settings cache and the full page cache. Useful after
// direct DB edits, imports, or when a stale page just won't go away.
export async function clearSiteCache() {
  const user = await assertPermission('settings')
  const { CACHE_TAGS } = await import('@/lib/shop/queries')
  revalidateTag(CACHE_TAGS.catalog, 'max')
  revalidateTag(CACHE_TAGS.categories, 'max')
  revalidateTag(CACHE_TAGS.reviews, 'max')
  revalidateTag(CACHE_TAGS.checkout, 'max')
  revalidateTag(STORE_SETTINGS_TAG, 'max')
  revalidatePath('/', 'layout')
  const { auditLog } = await import('@/lib/audit-log')
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'settings', entity: 'settings',
    details: 'Очищен кеш сайта',
  })
  return { success: true as const }
}

// Whether the "Sign in with Google" button should be shown on the storefront.
// DB settings (admin center) take priority; env vars remain as a fallback so
// existing deployments configured through Vercel env keep working.
export async function getGoogleAuthEnabled(): Promise<boolean> {
  const s = await getStoreSettingsInternal().catch(() => null)
  if (s?.googleAuth.enabled && s.googleAuth.clientId.trim() && s.googleAuth.clientSecret.trim()) {
    return true
  }
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}
