import { headers } from 'next/headers'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { getShopUser } from '@/lib/session'
import { pool } from '@/lib/db'
import { getLocale, getDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'

export async function EmailVerifyBanner() {
  const pathname = (await headers()).get('x-pathname') ?? ''
  if (pathname === '/account/verify-email' || pathname.startsWith('/account/verify-email/')) return null

  const user = await getShopUser()
  if (!user) return null

  let needsVerify = false
  try {
    const { rows } = await pool.query<{ emailVerified: boolean; role: string | null }>(
      `SELECT "emailVerified", role FROM "user" WHERE id=$1 LIMIT 1`,
      [user.id],
    )
    const row = rows[0]
    needsVerify = Boolean(row && row.role === 'customer' && !row.emailVerified)
    if (needsVerify) {
      const google = await pool.query(
        `SELECT 1 FROM account WHERE "userId"=$1 AND "providerId"='google' LIMIT 1`,
        [user.id],
      )
      if (google.rows.length > 0) {
        await pool.query(`UPDATE "user" SET "emailVerified"=true, "updatedAt"=NOW() WHERE id=$1`, [user.id])
        needsVerify = false
      }
    }
  } catch {
    needsVerify = false
  }
  if (!needsVerify) return null

  const locale = await getLocale()
  const dict = getDictionary(locale)
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <Mail className="mt-0.5 size-4 shrink-0" />
        <span>{dict.auth.verifyEmailBanner}</span>
      </p>
      <Link
        href={localizedPath('/account/verify-email', locale)}
        className="inline-flex h-9 items-center justify-center rounded-md bg-amber-900 px-3 text-sm font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
      >
        {dict.auth.verifyEmailOpen}
      </Link>
    </div>
  )
}
