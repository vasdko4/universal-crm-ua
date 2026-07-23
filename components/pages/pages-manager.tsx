'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { deletePage, togglePageStatus, type PageInput } from '@/app/actions/pages'
import type { Page } from '@/lib/db/schema'
import { PageEditorDialog } from './page-editor-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Menu as MenuIcon,
  ExternalLink,
} from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type ListData = {
  items: Page[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function PagesManager({ initialData }: { initialData: ListData }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { dict } = useAdminI18n()
  const t = dict.pages

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const status = (searchParams.get('status') as 'all' | 'draft' | 'published') ?? 'all'

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Page | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null)

  useEffect(() => {
    setSearch(searchParams.get('q') ?? '')
  }, [searchParams])

  function pushParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
      else params.delete(k)
    })
    startTransition(() => router.push(`/admin/pages?${params.toString()}`))
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    pushParams({ q: search || undefined, page: undefined })
  }

  function openCreate() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(p: Page) {
    setEditing(p)
    setEditorOpen(true)
  }

  function handleToggle(p: Page) {
    startTransition(async () => {
      await togglePageStatus(p.id, p.status === 'published' ? 'draft' : 'published')
      toast.success(p.status === 'published' ? t.toastUnpublished : t.toastPublished)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    startTransition(async () => {
      await deletePage(target.id)
      toast.success(t.toastDeleted)
      router.refresh()
    })
  }

  const { items, page, totalPages, total } = initialData

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.subtitle} — {total}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t.createPage}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(v) => pushParams({ status: v, page: undefined })}>
          <TabsList>
            <TabsTrigger value="all">{t.tabAll}</TabsTrigger>
            <TabsTrigger value="published">{t.tabPublished}</TabsTrigger>
            <TabsTrigger value="draft">{t.tabDraft}</TabsTrigger>
          </TabsList>
        </Tabs>
        <form onSubmit={submitSearch} className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.colTitle}</TableHead>
              <TableHead>{t.colUrl}</TableHead>
              <TableHead>{t.colStatus}</TableHead>
              <TableHead>{t.colInMenu}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <FileText className="mx-auto mb-3 size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t.empty}</p>
                </TableCell>
              </TableRow>
            )}
            {items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <button
                    onClick={() => openEdit(p)}
                    className="text-left font-medium text-foreground hover:text-primary"
                  >
                    {p.title}
                  </button>
                  {p.template !== 'default' && (
                    <span className="ml-2 text-xs text-muted-foreground">({p.template})</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    /{p.slug}
                    <ExternalLink className="size-3" />
                  </span>
                </TableCell>
                <TableCell>
                  {p.status === 'published' ? (
                    <Badge className="border-success/30 bg-success/15 text-success">{t.published}</Badge>
                  ) : (
                    <Badge variant="secondary">{t.draft}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {p.showInMenu ? (
                    <span className="inline-flex items-center gap-1 text-sm text-foreground">
                      <MenuIcon className="size-3.5" /> {t.yes}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={t.actionsAria}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(p)}>
                        <Pencil className="size-4" /> {t.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(p)}>
                        {p.status === 'published' ? (
                          <>
                            <EyeOff className="size-4" /> {t.unpublish}
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" /> {t.publish}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="size-4" /> {t.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t.pageOf.replace('{page}', String(page)).replace('{total}', String(totalPages))}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => pushParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="size-4" /> {t.back}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => pushParams({ page: String(page + 1) })}
            >
              {t.next} <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <PageEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        page={editing}
        onSaved={() => {
          setEditorOpen(false)
          router.refresh()
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteDescription.replace('{title}', deleteTarget?.title ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
