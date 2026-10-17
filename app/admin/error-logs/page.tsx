import { requirePermission } from '@/lib/session'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { getErrorLogs, getErrorLogTags } from '@/app/actions/error-logs'
import { ErrorLogsViewer } from '@/components/error-logs/error-logs-viewer'

export const dynamic = 'force-dynamic'

export default async function ErrorLogsPage() {
  const user = await requirePermission('logs')
  const t = getAdminDictionary(user.locale).errorLogs
  const [initial, tags] = await Promise.all([
    getErrorLogs({ resolved: false }),
    getErrorLogTags(),
  ])

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <ErrorLogsViewer initial={initial} tags={tags} t={t} />
    </main>
  )
}
