import { requirePermission } from '@/lib/session'
import { getAdminLogs } from '@/app/actions/admin-logs'
import { LogsViewer } from '@/components/admin-logs/logs-viewer'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Логи — Админ-центр' }

export default async function AdminLogsPage() {
  await requirePermission('logs')
  const initial = await getAdminLogs()

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <LogsViewer initial={initial} />
    </main>
  )
}
