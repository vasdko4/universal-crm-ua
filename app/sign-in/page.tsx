import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/session'
import { countUsers } from '@/app/actions/users'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { SignInForm } from '@/components/auth/sign-in-form'
import { getLocale } from '@/lib/i18n/server'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'

export const dynamic = 'force-dynamic'

export default async function SignInPage() {
  const user = await getAdminUser()
  if (user) redirect('/admin')

  const [total, settings, locale] = await Promise.all([
    countUsers().catch(() => 0),
    getStoreSettingsInternal().catch(() => null),
    getLocale(),
  ])

  if (total === 0) redirect('/setup')

  const dict = getAdminDictionary(locale)
  return (
    <SignInForm
      needsBootstrap={false}
      storeName={settings?.storeName ?? dict.sidebar.adminCenter}
      copy={dict.signIn}
    />
  )
}
