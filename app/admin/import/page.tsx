import { getImportTasks } from "@/app/actions/import"
import { ImportManager } from "@/components/import-manager"

export const dynamic = "force-dynamic"

export default async function ImportPage() {
  const tasks = await getImportTasks()
  return <ImportManager tasks={tasks} />
}
