'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { dbForClient, withDbClient } from '@/lib/db'
import { storeSettings } from '@/lib/db/schema'
import { assertPermission, assertWritePermission } from '@/lib/session'
import {
  STORE_SETTINGS_TAG,
  getStoreSettingsInternal,
  normalizeStoreSettingsRow,
  projectPublicStoreSettings,
  stripSecrets,
  type PublicStoreSettings,
  type StoreSettingsData,
} from '@/lib/store-settings'
import {
  decryptConfigSecrets,
  encryptConfigSecrets,
  STORE_EMAIL_SECRET_KEYS,
  STORE_GOOGLE_AUTH_SECRET_KEYS,
  STORE_NOTIFICATIONS_SECRET_KEYS,
  STORE_PROM_SECRET_KEYS,
} from '@/lib/secrets'

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
  HomeHeroSlide,
  HomeBenefitItem,
  HomeBenefitsSettings,
  MinOrderSettings,
  PublicStoreSettings,
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
  return stripSecrets(await getStoreSettingsInternal())
}

// Public, unauthenticated projection for storefront pages (cart, checkout,
// one-click buy) and GET /api/v1/store. Returns ONLY the allowlisted
// PublicStoreSettings shape (projectPublicStoreSettings) — no secrets, no
// integration config, no admin-only flags ever leave the server here, even
// though this action is directly invocable by anyone. Prefer
// getStoreSettingsInternal() directly for server-only library code instead
// of this, to avoid the extra copy.
export async function getPublicStoreSettings(): Promise<PublicStoreSettings> {
  return projectPublicStoreSettings(await getStoreSettingsInternal())
}

// Shared writer. Not exported directly — the public entrypoint below adds the
// admin permission check. The setup wizard writes settings via direct SQL in
// app/actions/setup.ts, guarded by the fresh-install check there.
const CLEAR_SECRET = '__CLEAR__'

function keepSecret(next: string | undefined, prev: string): string {
  if (next === CLEAR_SECRET) return ''
  return next && next.trim() ? next : prev
}

async function writeStoreSettings(data: Partial<StoreSettingsData>) {
  // Serialize the read-modify-write under a row lock: the old code read via
  // the cached getStoreSettingsInternal(), merged, and overwrote the whole
  // row — a Prom sync that wrote prom.lastSyncAt in between was silently
  // rolled back by the stale merge. The locked read sees the freshest
  // committed state (bypassing unstable_cache), and a concurrent writer
  // waits for this transaction. Raw SELECT * (not drizzle select()) keeps
  // the existing guard: a live DB missing a later ALTER column still
  // returns a row instead of 500ing. No version column needed — the lock
  // alone serializes the two writers.
  const { current, merged } = await withDbClient(async (client) => {
    const { rows } = await client.query('SELECT * FROM store_settings WHERE id = 1 FOR UPDATE')
    const s = normalizeStoreSettingsRow(rows[0] ?? null)
    const current: StoreSettingsData = {
      ...s,
      emailSettings: decryptConfigSecrets(s.emailSettings, STORE_EMAIL_SECRET_KEYS),
      notifications: decryptConfigSecrets(s.notifications, STORE_NOTIFICATIONS_SECRET_KEYS),
      googleAuth: decryptConfigSecrets(s.googleAuth, STORE_GOOGLE_AUTH_SECRET_KEYS),
      prom: decryptConfigSecrets(s.prom, STORE_PROM_SECRET_KEYS),
    }
    const merged = { ...current, ...data }
    if (data.emailSettings) {
      merged.emailSettings = {
        ...current.emailSettings,
        ...data.emailSettings,
        smtpUser: keepSecret(data.emailSettings.smtpUser, current.emailSettings.smtpUser),
        smtpPassword: keepSecret(data.emailSettings.smtpPassword, current.emailSettings.smtpPassword),
        dkimPrivateKey: keepSecret(data.emailSettings.dkimPrivateKey, current.emailSettings.dkimPrivateKey),
      }
    }
    if (data.notifications) {
      merged.notifications = {
        ...current.notifications,
        ...data.notifications,
        telegramBotToken: keepSecret(data.notifications.telegramBotToken, current.notifications.telegramBotToken),
        telegramChatId: keepSecret(data.notifications.telegramChatId, current.notifications.telegramChatId),
      }
    }
    if (data.googleAuth) {
      merged.googleAuth = {
        ...current.googleAuth,
        ...data.googleAuth,
        clientSecret: keepSecret(data.googleAuth.clientSecret, current.googleAuth.clientSecret),
      }
    }
    if (data.prom) {
      merged.prom = {
        ...current.prom,
        ...data.prom,
        apiToken: keepSecret(data.prom.apiToken, current.prom.apiToken),
      }
    }
    // SECURITY: integration secrets are encrypted at rest — lib/secrets.ts.
    // Encryption is idempotent, so carried-over (already encrypted) values
    // from keepSecret() are not double-encrypted.
    merged.emailSettings = encryptConfigSecrets(merged.emailSettings, STORE_EMAIL_SECRET_KEYS)
    merged.notifications = encryptConfigSecrets(merged.notifications, STORE_NOTIFICATIONS_SECRET_KEYS)
    merged.googleAuth = encryptConfigSecrets(merged.googleAuth, STORE_GOOGLE_AUTH_SECRET_KEYS)
    merged.prom = encryptConfigSecrets(merged.prom, STORE_PROM_SECRET_KEYS)
    const values = {
      storeName: merged.storeName,
      storeDescription: merged.storeDescription,
      logoUrl: merged.logoUrl,
      faviconUrl: merged.faviconUrl,
      openCartAfterAdd: merged.openCartAfterAdd,
      storefrontCacheEnabled: merged.storefrontCacheEnabled,
      sessionBindingEnabled: merged.sessionBindingEnabled,
      defaultLocale: merged.defaultLocale,
      localePromptMode: merged.localePromptMode === 'modal' ? 'modal' : 'browser',
      activeTemplate: merged.activeTemplate,
      adminTheme: merged.adminTheme,
      seo: merged.seo,
      social: merged.social,
      googleAds: merged.googleAds,
      merchantFeed: merged.merchantFeed,
      emailSettings: merged.emailSettings,
      contact: merged.contact,
      notifications: merged.notifications,
      googleAuth: merged.googleAuth,
      homeHero: merged.homeHero,
      homeBenefits: merged.homeBenefits,
      minOrder: merged.minOrder,
      prom: merged.prom,
      updatedAt: new Date(),
    }
    const tx = dbForClient(client)
    await tx
      .insert(storeSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: storeSettings.id, set: values })
    return { current, merged }
  })
  // Google OAuth credentials feed the Better Auth instance — drop its cache so
  // new keys apply without a server restart.
  const { invalidateAuthCache } = await import('@/lib/auth')
  invalidateAuthCache()
  revalidateTag(STORE_SETTINGS_TAG, 'max')
  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout')
  if (current.storefrontCacheEnabled !== merged.storefrontCacheEnabled) {
    const { revalidateStorefront } = await import('@/lib/shop/cache')
    revalidateStorefront()
  }
  return { success: true }
}


/** Top-level keys of StoreSettingsData (3.4.109, P3). */
const STORE_SETTINGS_KEYS = new Set([
  'storeName', 'storeDescription', 'logoUrl', 'faviconUrl', 'openCartAfterAdd',
  'storefrontCacheEnabled', 'sessionBindingEnabled', 'defaultLocale',
  'localePromptMode', 'activeTemplate', 'adminTheme', 'seo', 'social',
  'googleAds', 'merchantFeed', 'emailSettings', 'contact', 'notifications',
  'googleAuth', 'homeHero', 'homeBenefits', 'minOrder', 'adsSpend', 'prom',
])

/**
 * Shape guard for updateStoreSettings input (3.4.109, P3): the old code
 * merged arbitrary admin-supplied JSON into the settings row with no
 * validation at all. Unknown top-level keys are rejected; every string
 * leaf is capped (5000 chars), numbers must be finite, nesting is bounded.
 * This is a shape guard, not a per-field schema — field-level rules live
 * with the individual settings editors.
 */
function validateStoreSettingsInput(data: unknown): asserts data is Partial<StoreSettingsData> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Налаштування мають бути обʼєктом')
  }
  for (const key of Object.keys(data)) {
    if (!STORE_SETTINGS_KEYS.has(key)) {
      throw new Error(`Невідомий ключ налаштувань: ${key}`)
    }
  }
  const check = (value: unknown, depth: number): void => {
    if (typeof value === 'string') {
      if (value.length > 5000) throw new Error('Значення налаштування занадто довге')
      return
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Недопустиме числове значення')
      return
    }
    if (typeof value === 'boolean' || value === null) return
    if (Array.isArray(value)) {
      if (value.length > 200) throw new Error('Забагато елементів у налаштуванні')
      if (depth >= 5) throw new Error('Налаштування занадто глибоко вкладені')
      for (const item of value) check(item, depth + 1)
      return
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length > 100) throw new Error('Забагато ключів у налаштуванні')
      if (depth >= 5) throw new Error('Налаштування занадто глибоко вкладені')
      for (const [, v] of entries) check(v, depth + 1)
      return
    }
    throw new Error('Недопустимий тип значення налаштування')
  }
  for (const value of Object.values(data as Record<string, unknown>)) check(value, 0)
}

export async function updateStoreSettings(data: Partial<StoreSettingsData>) {
  const user = await assertWritePermission('settings')
  try {
    validateStoreSettingsInput(data)
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : 'Некорректні налаштування' }
  }
  // The settings UI keeps one big object in state and always submits it in
  // full on save, so `Object.keys(data)` lists every field regardless of
  // what the admin actually touched. Diff against the current row first so
  // the audit log only names fields whose value really changed.
  const before = await getStoreSettingsInternal()
  const beforePublic = stripSecrets(before)
  const changedKeys = Object.keys(data).filter((key) => {
    const k = key as keyof StoreSettingsData
    return JSON.stringify(beforePublic[k]) !== JSON.stringify(data[k])
  })
  try {
    const result = await writeStoreSettings(data)
    const { auditLog, fillAuditTemplate } = await import('@/lib/audit-log')
    const { getAdminDictionary } = await import('@/lib/i18n/admin/dictionaries')
    const t = getAdminDictionary(user.locale).auditLog
    void auditLog({
      userId: user.id, userName: user.name, userEmail: user.email,
      action: 'settings', entity: 'settings',
      details:
        changedKeys.length > 0
          ? fillAuditTemplate(t.settingsUpdated, { keys: changedKeys.join(', ') })
          : t.settingsUnchanged,
    })
    return result
  } catch (e) {
    // A fresh `docker pull` without pressing "Check DB version" in
    // /admin/updates leaves new settings columns missing — surface that as
    // a friendly message instead of crashing the page (Next.js error
    // boundary) and silently losing the form input.
    const msg = e instanceof Error ? e.message : String(e)
    if (/column .* does not exist/i.test(msg)) {
      console.error('[settings] save failed, DB migration missing:', msg)
      return { success: false as const, needsMigration: true as const }
    }
    console.error('[settings] save failed:', msg)
    return { success: false as const }
  }
}

export async function updateAppearance(data: { activeTemplate?: string; defaultLocale?: string; adminTheme?: string }) {
  return updateStoreSettings(data)
}

// Admin "Clear cache" button (Настройки → Система). Busts every server-side
// cache the storefront uses: catalog/category/product/review/checkout query
// caches, the store-settings cache and the full page cache. Useful after
// direct DB edits, imports, or when a stale page just won't go away.
export async function clearSiteCache() {
  const user = await assertWritePermission('settings')
  const { CACHE_TAGS } = await import('@/lib/shop/queries')
  revalidateTag(CACHE_TAGS.catalog, 'max')
  revalidateTag(CACHE_TAGS.categories, 'max')
  revalidateTag(CACHE_TAGS.reviews, 'max')
  revalidateTag(CACHE_TAGS.checkout, 'max')
  revalidateTag(STORE_SETTINGS_TAG, 'max')
  revalidatePath('/', 'layout')
  const { auditLog } = await import('@/lib/audit-log')
  const { getAdminDictionary } = await import('@/lib/i18n/admin/dictionaries')
  void auditLog({
    userId: user.id, userName: user.name, userEmail: user.email,
    action: 'settings', entity: 'settings',
    details: getAdminDictionary(user.locale).auditLog.cacheCleared,
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

/**
 * Sends a test email using the current SMTP settings.
 * Returns the result so the admin UI can show success or the exact error.
 */
export async function sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
  await assertWritePermission('settings')
  const { sendMail } = await import('@/lib/mailer')
  const { getStoreSettingsInternal } = await import('@/lib/store-settings')
  const settings = await getStoreSettingsInternal()
  const fromName = settings.storeName || 'PowerFox'

  try {
    const result = await sendMail({
      to: to.trim(),
      subject: `Тестовий лист — ${fromName}`,
      text: `Це тестовий лист з ${fromName}. SMTP налаштовано правильно.`,
      html: `<p>Це тестовий лист з <strong>${fromName}</strong>. SMTP налаштовано правильно.</p>`,
    })
    if (result.sent) {
      return { success: true, message: 'Тестовий лист відправлено' }
    }
    return { success: false, message: 'SMTP не налаштовано — лист не відправлено' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Sanitize: don't leak the full error which might contain credentials
    const safe = msg.replace(/pass\w*["']?\s*[:=]\s*["']?[^"'\s,}]+/gi, 'pass=[hidden]')
    return { success: false, message: `Помилка: ${safe.slice(0, 300)}` }
  }
}
