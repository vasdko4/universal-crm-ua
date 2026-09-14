import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAdminUser, staffTwoFactorSatisfied } from '@/lib/session'
import { isSetupNeeded } from '@/app/actions/setup'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { SignInForm } from '@/components/auth/sign-in-form'
import { getLocale } from '@/lib/i18n/server'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const dict = getAdminDictionary(locale)
  return {
    title: dict.signIn.subtitle,
    robots: { index: false, follow: false },
  }
}

export default async function SignInPage() {
  const user = await getAdminUser()
  const twoFaOk = user ? await staffTwoFactorSatisfied(user.id) : true
  if (user && twoFaOk) redirect('/admin')

  const [needsSetup, settings, locale] = await Promise.all([
    isSetupNeeded().catch(() => false),
    getStoreSettingsInternal().catch(() => null),
    getLocale(),
  ])

  if (needsSetup) redirect('/setup')

  const dict = getAdminDictionary(locale)
  return (
    <SignInForm
      needsBootstrap={false}
      storeName={settings?.storeName ?? dict.sidebar.adminCenter}
      copy={dict.signIn}
      initialNeedsOtp={Boolean(user && !twoFaOk)}
    />
  )
}
