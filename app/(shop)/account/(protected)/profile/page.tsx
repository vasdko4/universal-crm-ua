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

  const { rows } = await pool.query(
    `SELECT "providerId", password FROM account WHERE "userId"=$1`,
    [user.id],
  )
  const isGoogleAccount = rows.some((r: { providerId: string }) => r.providerId === 'google')
  const hasPassword = rows.some(
    (r: { providerId: string; password: string | null }) =>
      r.providerId === 'credential' && Boolean(r.password),
  )

  // The form's first card already carries the section title + description;
  // a page-level heading here would duplicate it ("Особисті дані" twice).
  return (
    <ProfileForm
      initialName={user.name}
      initialPhone={user.phone ?? ''}
      email={user.email}
      emailLocked={isGoogleAccount}
      passwordLocked={isGoogleAccount || !hasPassword}
      hasPassword={hasPassword}
    />
  )
}
