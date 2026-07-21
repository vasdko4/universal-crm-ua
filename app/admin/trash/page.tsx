import { getTrashedProducts } from "@/app/actions/products"
import { TrashManager } from "@/components/trash-manager"

export const dynamic = "force-dynamic"

export default async function TrashPage() {
  const products = await getTrashedProducts()
  return <TrashManager products={products} />
}
