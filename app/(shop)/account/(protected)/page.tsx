import type { Metadata } from 'next'
import { getShopUser } from '@/lib/session'
import { pool } from '@/lib/db'
import { ProfileForm } from '@/components/shop/profile-form'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getDictionary(locale)
  return { title: dict.profile.sectionTitle }
}

export default async function AccountProfilePage() {
  const user = await getShopUser()
  if (!user) return null

  const locale = await getLocale()
  const dict = getDictionary(locale)
  const t = dict.profile

  const { rows } = await pool.query(
    `SELECT "providerId", password FROM account WHERE "userId"=$1`,
    [user.id],
  )
  const isGoogleAccount = rows.some((r: { providerId: string }) => r.providerId === 'google')
  const hasPassword = rows.some(
    (r: { providerId: string; password: string | null }) =>
      r.providerId === 'credential' && Boolean(r.password),
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{t.sectionTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.sectionDescription}</p>
      </div>
      <ProfileForm
        initialName={user.name}
        initialPhone={user.phone ?? ''}
        email={user.email}
        emailLocked={isGoogleAccount}
        passwordLocked={isGoogleAccount || !hasPassword}
      />
    </div>
  )
}
