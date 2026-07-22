'use server'

import { revalidatePath } from 'next/cache'
import { pool } from '@/lib/db'
import { getAdminUser } from '@/lib/session'
import { isLocale, type Locale } from '@/lib/i18n/config'

/**
 * Persists the signed-in admin's interface language to the DB (user.locale),
 * so it's tied to their account and never has to be re-asked on the next
 * login or on another device — unlike the storefront language, which lives
 * in a cookie (see app/actions/locale.ts).
 */
export async function setAdminLocale(value: string): Promise<{ success: boolean; locale?: Locale }> {
  if (!isLocale(value)) return { success: false }
  const user = await getAdminUser()
  if (!user) return { success: false }

  await pool.query('UPDATE "user" SET locale = $1 WHERE id = $2', [value, user.id])
  revalidatePath('/admin', 'layout')
  return { success: true, locale: value }
}
