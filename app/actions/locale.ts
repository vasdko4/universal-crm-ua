'use server'

import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { localeByIp } from '@/lib/db/schema'
import { LOCALE_COOKIE, isLocale, normalizeLocale, type Locale } from '@/lib/i18n/config'

/** Client IP for server actions (no Request object available — use headers). */
async function actionClientIp(): Promise<string | null> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

export async function setLocale(value: string) {
  const locale = normalizeLocale(value)
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  // Best-effort: remember this locale for the visitor's IP so a different
  // browser/device on the same network isn't asked again (see
  // components/shop/locale-modal.tsx). Not a strong per-person identity —
  // an IP can be shared (office/family/mobile carrier) or change — so this is
  // only ever used as a default suggestion, never to silently override an
  // explicit per-browser cookie choice.
  const ip = await actionClientIp()
  if (ip) {
    await db
      .insert(localeByIp)
      .values({ ip, locale })
      .onConflictDoUpdate({ target: localeByIp.ip, set: { locale, updatedAt: new Date() } })
      .catch(() => {})
  }

  revalidatePath('/', 'layout')
  return { success: true, locale }
}

/**
 * Looks up a previously-chosen locale for the visitor's current IP. Used by
 * the first-visit language modal to skip asking again when a returning
 * visitor's IP already has a remembered choice (new browser/device, cleared
 * cookies, etc). Returns null when there's no match or no IP.
 */
export async function getLocaleForCurrentIp(): Promise<Locale | null> {
  const ip = await actionClientIp()
  if (!ip) return null
  const [row] = await db.select().from(localeByIp).where(eq(localeByIp.ip, ip)).limit(1)
  if (!row || !isLocale(row.locale)) return null
  return row.locale
}
