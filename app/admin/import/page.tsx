import { getImportTasks } from "@/app/actions/import"
import { ImportManager } from "@/components/import-manager"
import { requirePermission } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function ImportPage() {
  await requirePermission("import")
  const tasks = await getImportTasks()
  return <ImportManager tasks={tasks} />
}
