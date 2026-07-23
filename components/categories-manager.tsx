'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryVisibility,
  type CategoryInput,
} from '@/app/actions/categories'
import type { Category } from '@/lib/db/schema'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Loader2, FolderTree } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { pluralize } from '@/lib/i18n/plural'

type CategoryWithCount = Category & { productCount: number }

type FormState = {
  nameRu: string
  nameUk: string
  descriptionRu: string
  descriptionUk: string
  parentId: string
  isVisible: boolean
  sortOrder: string
}

const emptyForm: FormState = {
  nameRu: '',
  nameUk: '',
  descriptionRu: '',
  descriptionUk: '',
  parentId: '',
  isVisible: true,
  sortOrder: '0',
}

export function CategoriesManager({ categories }: { categories: CategoryWithCount[] }) {
  const router = useRouter()
  const { dict } = useAdminI18n()
  const t = dict.categories
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryWithCount | null>(null)
  const [deleting, setDeleting] = useState<CategoryWithCount | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const nameById = new Map(categories.map((c) => [c.id, c.nameRu]))

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(cat: CategoryWithCount) {
    setEditing(cat)
    setForm({
      nameRu: cat.nameRu,
      nameUk: cat.nameUk,
      descriptionRu: cat.descriptionRu ?? '',
      descriptionUk: cat.descriptionUk ?? '',
      parentId: cat.parentId ? String(cat.parentId) : '',
      isVisible: cat.isVisible ?? true,
      sortOrder: String(cat.sortOrder ?? 0),
    })
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nameRu.trim() || !form.nameUk.trim()) {
      toast.error(t.toastFillBothLanguages)
      return
    }
    const input: CategoryInput = {
      nameRu: form.nameRu,
      nameUk: form.nameUk,
      descriptionRu: form.descriptionRu || null,
      descriptionUk: form.descriptionUk || null,
      parentId: form.parentId ? Number(form.parentId) : null,
      isVisible: form.isVisible,
      sortOrder: Math.trunc(Number(form.sortOrder) || 0),
    }
    startTransition(async () => {
      const result = editing ? await updateCategory(editing.id, input) : await createCategory(input)
      if (result.success) {
        toast.success(editing ? t.toastUpdated : t.toastCreated)
        setDialogOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? t.toastSaveError)
      }
    })
  }

  function handleDelete() {
    if (!deleting) return
    startTransition(async () => {
      const result = await deleteCategory(deleting.id)
      if (result.success) {
        toast.success(t.toastDeleted)
        router.refresh()
      } else {
        toast.error(result.error ?? t.toastDeleteError)
      }
      setDeleting(null)
    })
  }

  function handleToggle(cat: CategoryWithCount) {
    startTransition(async () => {
      await toggleCategoryVisibility(cat.id, !(cat.isVisible ?? true))
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-balance">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {categories.length} {pluralize(categories.length, t.countOne, t.countFew, t.countMany)}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t.addCategory}
        </Button>
      </header>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>{t.colName}</TableHead>
              <TableHead className="hidden md:table-cell">{t.colSlug}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.colParent}</TableHead>
              <TableHead className="text-right">{t.colProducts}</TableHead>
              <TableHead>{t.colVisibility}</TableHead>
              <TableHead className="w-24 text-right">{t.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FolderTree className="size-8" />
                    <p className="text-sm">{t.notFound}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <p className="font-medium">{cat.nameRu}</p>
                    <p className="text-xs text-muted-foreground">{cat.nameUk}</p>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {cat.slug}
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">
                    {cat.parentId ? nameById.get(cat.parentId) ?? '—' : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{cat.productCount}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleToggle(cat)}
                      disabled={isPending}
                      className="cursor-pointer"
                      aria-label={cat.isVisible ? t.hideAria : t.showAria}
                    >
                      {cat.isVisible ? (
                        <Badge className="bg-success/15 text-success hover:bg-success/25">
                          {t.visible}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t.hidden}</Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(cat)}
                        aria-label={`${t.editAria} ${cat.nameRu}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleting(cat)}
                        aria-label={`${t.deleteAria} ${cat.nameRu}`}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.editTitle : t.newTitle}</DialogTitle>
            <DialogDescription>
              {t.dialogHint}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="catNameRu">{t.nameRu}</Label>
                <Input
                  id="catNameRu"
                  value={form.nameRu}
                  onChange={(e) => setForm((f) => ({ ...f, nameRu: e.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="catNameUk">{t.nameUk}</Label>
                <Input
                  id="catNameUk"
                  value={form.nameUk}
                  onChange={(e) => setForm((f) => ({ ...f, nameUk: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="catDescRu">{t.descriptionRu}</Label>
              <Textarea
                id="catDescRu"
                rows={2}
                value={form.descriptionRu}
                onChange={(e) => setForm((f) => ({ ...f, descriptionRu: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{t.parentCategory}</Label>
                <Select
                  value={form.parentId || 'none'}
                  onValueChange={(v) => setForm((f) => ({ ...f, parentId: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.none} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.noneRoot}</SelectItem>
                    {categories
                      .filter((c) => c.id !== editing?.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nameRu}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="catSort">{t.sortOrder}</Label>
                <Input
                  id="catSort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="catVisible">{t.showOnSite}</Label>
              <Switch
                id="catVisible"
                checked={form.isVisible}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isVisible: v }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {editing ? t.save : t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleting?.nameRu}» {t.deleteDescription}
              {deleting && deleting.productCount > 0 && (
                <> {t.deleteWithProducts}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
