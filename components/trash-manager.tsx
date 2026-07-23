"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { restoreProducts, permanentlyDeleteProducts, emptyTrash } from "@/app/actions/products"
import { useAdminI18n } from "@/lib/i18n/admin/context"
import { pickLocalized } from "@/lib/i18n/config"
import { pluralize } from "@/lib/i18n/plural"

type TrashedProduct = {
  id: number
  nameRu: string | null
  nameUk: string | null
  sku: string | null
  price: string
  quantity: number
  deletedAt: Date | null
}

export function TrashManager({ products }: { products: TrashedProduct[] }) {
  const router = useRouter()
  const { dict, locale } = useAdminI18n()
  const t = dict.trash
  const productName = (p: TrashedProduct) => pickLocalized(locale, p.nameUk, p.nameRu) || t.noName
  const [selected, setSelected] = useState<number[]>([])
  const [isPending, startTransition] = useTransition()

  const allSelected = products.length > 0 && selected.length === products.length

  function toggleAll() {
    setSelected(allSelected ? [] : products.map((p) => p.id))
  }

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleRestore(ids: number[]) {
    startTransition(async () => {
      const res = await restoreProducts(ids)
      if (res.success) {
        toast.success(`${t.toastRestored}: ${ids.length}`)
        setSelected([])
        router.refresh()
      } else {
        toast.error(res.error || t.toastRestoreError)
      }
    })
  }

  function handleDelete(ids: number[]) {
    startTransition(async () => {
      const res = await permanentlyDeleteProducts(ids)
      if (res.success) {
        toast.success(`${t.toastDeletedForever}: ${ids.length}`)
        setSelected([])
        router.refresh()
      } else {
        toast.error(res.error || t.toastDeleteError)
      }
    })
  }

  function handleEmptyTrash() {
    startTransition(async () => {
      const res = await emptyTrash()
      if (res.success) {
        toast.success(t.toastEmptied)
        setSelected([])
        router.refresh()
      } else {
        toast.error(t.toastEmptyError)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={selected.length === 0 || isPending}
          onClick={() => handleRestore(selected)}
        >
          <RotateCcw className="size-4" />
          {t.restore} ({selected.length})
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={selected.length === 0 || isPending}>
              <Trash2 className="size-4" />
              {t.deleteForever} ({selected.length})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.deleteSelectedTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.deleteSelectedDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(selected)}>
                {t.deleteForever}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {products.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto text-destructive" disabled={isPending}>
                <AlertTriangle className="size-4" />
                {t.emptyTrash}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.emptyTrashTitle}</AlertDialogTitle>
                <AlertDialogDescription>
                  {`${products.length} ${pluralize(products.length, t.itemOne, t.itemFew, t.itemMany)} ${t.emptyTrashDescription}`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={handleEmptyTrash}>{t.emptyTrash}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label={t.selectAllAria} />
              </TableHead>
              <TableHead>{t.colName}</TableHead>
              <TableHead>{t.colSku}</TableHead>
              <TableHead className="text-right">{t.colPrice}</TableHead>
              <TableHead className="text-right">{t.colQuantity}</TableHead>
              <TableHead>{t.colDeletedAt}</TableHead>
              <TableHead className="w-24 text-right">{t.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  {t.empty}
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id} data-state={selected.includes(p.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                      aria-label={`${t.selectRowAria} ${productName(p)}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{productName(p)}</TableCell>
                  <TableCell>
                    {p.sku ? <Badge variant="outline">{p.sku}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(p.price).toLocaleString("ru-RU")} грн
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString("ru-RU", { timeZone: "Europe/Kyiv" }) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleRestore([p.id])}
                        disabled={isPending}
                        aria-label={t.restoreAria}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => handleDelete([p.id])}
                        disabled={isPending}
                        aria-label={t.deleteForeverAria}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
