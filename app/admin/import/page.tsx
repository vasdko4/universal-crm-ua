import { getImportTasks } from "@/app/actions/import"
import { getUnfinishedPromImports } from "@/app/actions/prom-import"
import { ImportManager } from "@/components/import-manager"
import { requirePermission } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function ImportPage() {
  await requirePermission("import")
  const [tasks, resumablePromTasks] = await Promise.all([getImportTasks(), getUnfinishedPromImports()])
  return <ImportManager tasks={tasks} resumablePromTasks={resumablePromTasks} />
}
