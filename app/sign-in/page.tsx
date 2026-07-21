import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/session'
import { countUsers } from '@/app/actions/users'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { SignInForm } from '@/components/auth/sign-in-form'

export const dynamic = 'force-dynamic'

export default async function SignInPage() {
  const user = await getAdminUser()
  if (user) redirect('/admin')

  const [total, settings] = await Promise.all([
    countUsers().catch(() => 0),
    getStoreSettingsInternal().catch(() => null),
  ])

  // Fresh install with no users: send to the full setup wizard instead of the
  // inline bootstrap form.
  if (total === 0) redirect('/setup')

  return <SignInForm needsBootstrap={false} storeName={settings?.storeName ?? 'Админ-центр'} />
}
