import { requirePermission } from '@/lib/session'
import { GuidesViewer } from '@/components/guides/guides-viewer'

export const metadata = { title: 'Инструкции — Админ-центр' }

export default async function AdminGuidesPage() {
  await requirePermission('dashboard')

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Инструкции</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Пошаговые гайды по настройке и управлению магазином через админ-центр
        </p>
      </header>
      <GuidesViewer />
    </main>
  )
}
