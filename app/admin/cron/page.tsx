import { requirePermission } from '@/lib/session'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { getCronJobsAdmin } from '@/app/actions/cron'
import { CronManager } from '@/components/cron/cron-manager'

export const dynamic = 'force-dynamic'

export default async function AdminCronPage() {
  const user = await requirePermission('system_cron')
  const dict = getAdminDictionary(user?.locale ?? 'uk')
  const initial = await getCronJobsAdmin()

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <CronManager initial={initial} t={dict.cron} />
    </main>
  )
}
