import { redirect } from 'next/navigation'
import { isSetupNeeded } from '@/app/actions/setup'
import { getDatabaseStatus } from '@/app/actions/db-config'
import { SetupWizard } from '@/components/setup/setup-wizard'
import { DatabaseSetup } from '@/components/setup/database-setup'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Установка магазина',
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>
}) {
  const { preview } = await searchParams
  const isDev = process.env.NODE_ENV !== 'production'

  // Preview mode lets you inspect the wizard UI without a live database.
  if (preview && isDev) {
    if (preview === 'db') return <DatabaseSetup />
    return <SetupWizard />
  }

  // 1) The database must be reachable and migrated before anything else.
  const dbStatus = await getDatabaseStatus()
  if (!dbStatus.connected || !dbStatus.schemaReady) {
    return <DatabaseSetup />
  }

  // 2) Once at least one user exists the store is considered configured.
  const needed = await isSetupNeeded()
  if (!needed) redirect('/sign-in')

  return <SetupWizard />
}
