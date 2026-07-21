'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { LOCALE_COOKIE, normalizeLocale } from '@/lib/i18n/config'

export async function setLocale(value: string) {
  const locale = normalizeLocale(value)
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
  return { success: true, locale }
}
