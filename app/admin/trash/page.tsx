import { getTrashedProducts } from "@/app/actions/products"
import { TrashManager } from "@/components/trash-manager"
import { requirePermission } from "@/lib/session"

export const dynamic = "force-dynamic"

export default async function TrashPage() {
  await requirePermission("trash")
  const products = await getTrashedProducts()
  return <TrashManager products={products} />
}
