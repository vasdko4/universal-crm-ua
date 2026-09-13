import { redirect } from 'next/navigation'
import { getShopUser } from '@/lib/session'
import { pool } from '@/lib/db'
import { sendEmailVerification } from '@/app/actions/shop-auth'
import { VerifyEmailForm } from '@/components/shop/auth/verify-email-form'
import { getServerDictionary } from '@/lib/i18n/server'
import { localizedPath } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

export default async function VerifyEmailPage() {
  const { locale, dict: t } = await getServerDictionary()
  const user = await getShopUser()
  if (!user) redirect(localizedPath('/account/login', locale))

  const { rows } = await pool.query<{ emailVerified: boolean }>(
    `SELECT "emailVerified" FROM "user" WHERE id=$1 LIMIT 1`,
    [user.id],
  )
  if (rows[0]?.emailVerified) redirect(localizedPath('/account', locale))

  await sendEmailVerification()

  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-lg font-semibold text-card-foreground">{t.auth.verifyEmailTitle}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t.auth.verifyEmailDescription}</p>
      <div className="mt-6">
        <VerifyEmailForm email={user.email} />
      </div>
    </div>
  )
}
