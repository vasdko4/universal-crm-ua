'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createGroup,
  updateGroup,
  deleteGroup,
  toggleGroupActive,
  type GroupInput,
} from '@/app/actions/groups'
import type { ProductGroup } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Loader2, Layers } from 'lucide-react'

type GroupWithCount = ProductGroup & { productCount: number }

type FormState = {
  nameRu: string
  nameUk: string
  descriptionRu: string
  descriptionUk: string
  sortOrder: string
  isActive: boolean
}

const emptyForm: FormState = {
  nameRu: '',
  nameUk: '',
  descriptionRu: '',
  descriptionUk: '',
  sortOrder: '0',
  isActive: true,
}

export function GroupsManager({ groups }: { groups: GroupWithCount[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GroupWithCount | null>(null)
  const [deleting, setDeleting] = useState<GroupWithCount | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(group: GroupWithCount) {
    setEditing(group)
    setForm({
      nameRu: group.nameRu,
      nameUk: group.nameUk,
      descriptionRu: group.descriptionRu ?? '',
      descriptionUk: group.descriptionUk ?? '',
      sortOrder: String(group.sortOrder ?? 0),
      isActive: group.isActive ?? true,
    })
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nameRu.trim() || !form.nameUk.trim()) {
      toast.error('Заполните название на обоих языках')
      return
    }
    const input: GroupInput = {
      nameRu: form.nameRu,
      nameUk: form.nameUk,
      descriptionRu: form.descriptionRu || null,
      descriptionUk: form.descriptionUk || null,
      sortOrder: Math.trunc(Number(form.sortOrder) || 0),
      isActive: form.isActive,
    }
    startTransition(async () => {
      const result = editing ? await updateGroup(editing.id, input) : await createGroup(input)
      if (result.success) {
        toast.success(editing ? 'Группа обновлена' : 'Группа создана')
        setDialogOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Ошибка сохранения')
      }
    })
  }

  function handleDelete() {
    if (!deleting) return
    startTransition(async () => {
      const result = await deleteGroup(deleting.id)
      if (result.success) {
        toast.success('Группа удалена')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Ошибка удаления')
      }
      setDeleting(null)
    })
  }

  function handleToggle(group: GroupWithCount) {
    startTransition(async () => {
      await toggleGroupActive(group.id, !(group.isActive ?? true))
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-balance">Группы товаров</h1>
          <p className="text-sm text-muted-foreground">
            Подборки товаров для витрин и акций — {groups.length} групп
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Добавить группу
        </Button>
      </header>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Название</TableHead>
              <TableHead className="hidden md:table-cell">Slug</TableHead>
              <TableHead className="text-right">Товаров</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Порядок</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-24 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Layers className="size-8" />
                    <p className="text-sm">Групп пока нет</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <p className="font-medium">{group.nameRu}</p>
                    <p className="text-xs text-muted-foreground">{group.nameUk}</p>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {group.slug}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{group.productCount}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {group.sortOrder}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleToggle(group)}
                      disabled={isPending}
                      className="cursor-pointer"
                      aria-label={group.isActive ? 'Деактивировать группу' : 'Активировать группу'}
                    >
                      {group.isActive ? (
                        <Badge className="bg-success/15 text-success hover:bg-success/25">
                          Активна
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Неактивна</Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(group)}
                        aria-label={`Редактировать ${group.nameRu}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleting(group)}
                        aria-label={`Удалить ${group.nameRu}`}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Редактировать группу' : 'Новая группа'}</DialogTitle>
            <DialogDescription>
              Группы объединяют товары в подборки: «Хиты продаж», «Новинки» и т.д.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="grNameRu">Название (RU) *</Label>
                <Input
                  id="grNameRu"
                  value={form.nameRu}
                  onChange={(e) => setForm((f) => ({ ...f, nameRu: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="grNameUk">Название (UK) *</Label>
                <Input
                  id="grNameUk"
                  value={form.nameUk}
                  onChange={(e) => setForm((f) => ({ ...f, nameUk: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="grDescRu">Описание (RU)</Label>
              <Textarea
                id="grDescRu"
                rows={2}
                value={form.descriptionRu}
                onChange={(e) => setForm((f) => ({ ...f, descriptionRu: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="grSort">Порядок сортировки</Label>
                <Input
                  id="grSort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="grActive">Активна</Label>
                <Switch
                  id="grActive"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {editing ? 'Сохранить' : 'Создать'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить группу?</AlertDialogTitle>
            <AlertDialogDescription>
              Группа «{deleting?.nameRu}» будет удалена. Товары останутся, но связи с группой будут
              удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
