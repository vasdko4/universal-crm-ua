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
        toast.success(`Восстановлено товаров: ${ids.length}`)
        setSelected([])
        router.refresh()
      } else {
        toast.error(res.error || "Ошибка восстановления")
      }
    })
  }

  function handleDelete(ids: number[]) {
    startTransition(async () => {
      const res = await permanentlyDeleteProducts(ids)
      if (res.success) {
        toast.success(`Удалено навсегда: ${ids.length}`)
        setSelected([])
        router.refresh()
      } else {
        toast.error(res.error || "Ошибка удаления")
      }
    })
  }

  function handleEmptyTrash() {
    startTransition(async () => {
      const res = await emptyTrash()
      if (res.success) {
        toast.success("Корзина очищена")
        setSelected([])
        router.refresh()
      } else {
        toast.error("Ошибка очистки корзины")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Корзина</h1>
        <p className="text-sm text-muted-foreground">
          Удалённые товары. Их можно восстановить или удалить навсегда.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={selected.length === 0 || isPending}
          onClick={() => handleRestore(selected)}
        >
          <RotateCcw className="size-4" />
          Восстановить ({selected.length})
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={selected.length === 0 || isPending}>
              <Trash2 className="size-4" />
              Удалить навсегда ({selected.length})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить выбранные товары навсегда?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие необратимо. Товары и все связанные данные будут удалены из базы.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(selected)}>Удалить</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {products.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto text-destructive" disabled={isPending}>
                <AlertTriangle className="size-4" />
                Очистить корзину
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Очистить корзину полностью?</AlertDialogTitle>
                <AlertDialogDescription>
                  {`Все ${products.length} товаров будут удалены безвозвратно.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleEmptyTrash}>Очистить</AlertDialogAction>
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
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Выбрать все" />
              </TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Артикул</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-right">Кол-во</TableHead>
              <TableHead>Удалён</TableHead>
              <TableHead className="w-24 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Корзина пуста
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id} data-state={selected.includes(p.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                      aria-label={`Выбрать ${p.nameRu || p.nameUk || p.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{p.nameRu || p.nameUk || "Без названия"}</TableCell>
                  <TableCell>
                    {p.sku ? <Badge variant="outline">{p.sku}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(p.price).toLocaleString("ru-RU")} грн
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString("ru-RU") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleRestore([p.id])}
                        disabled={isPending}
                        aria-label="Восстановить"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        onClick={() => handleDelete([p.id])}
                        disabled={isPending}
                        aria-label="Удалить навсегда"
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
