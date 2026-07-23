import { requirePermission } from '@/lib/session'
import { GuidesViewer } from '@/components/guides/guides-viewer'

export const metadata = { title: 'Инструкции — Админ-центр' }

export default async function AdminGuidesPage() {
  await requirePermission('dashboard')

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <GuidesViewer />
    </main>
  )
}
