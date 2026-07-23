'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  deleteArticle,
  toggleArticleStatus,
  toggleArticleFeatured,
} from '@/app/actions/articles'
import type { Article, ArticleCategory } from '@/lib/db/schema'
import { ArticleEditorDialog } from './article-editor-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Newspaper,
  Eye,
  EyeOff,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type ArticleItem = Article & { categoryName: string | null }

type ListData = {
  items: ArticleItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function ArticlesManager({
  initialData,
  categories,
}: {
  initialData: ListData
  categories: ArticleCategory[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { dict } = useAdminI18n()
  const t = dict.articles

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const status = (searchParams.get('status') as 'all' | 'draft' | 'published') ?? 'all'
  const category = searchParams.get('category') ?? 'all'

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Article | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ArticleItem | null>(null)

  useEffect(() => {
    setSearch(searchParams.get('q') ?? '')
  }, [searchParams])

  function pushParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== 'all') params.set(k, v)
      else params.delete(k)
    })
    startTransition(() => router.push(`/admin/articles?${params.toString()}`))
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    pushParams({ q: search || undefined, page: undefined })
  }

  function handleToggleStatus(a: Article) {
    startTransition(async () => {
      await toggleArticleStatus(a.id, a.status === 'published' ? 'draft' : 'published')
      toast.success(a.status === 'published' ? t.toastUnpublished : t.toastPublished)
      router.refresh()
    })
  }

  function handleFeatured(a: Article) {
    startTransition(async () => {
      await toggleArticleFeatured(a.id, !a.isFeatured)
      toast.success(a.isFeatured ? t.toastFeaturedRemoved : t.toastFeaturedAdded)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    startTransition(async () => {
      await deleteArticle(target.id)
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
        <Button
          onClick={() => {
            setEditing(null)
            setEditorOpen(true)
          }}
        >
          <Plus className="size-4" />
          {t.newArticle}
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
        <div className="flex flex-wrap items-center gap-3">
          <Select value={category} onValueChange={(v) => pushParams({ category: v, page: undefined })}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t.categoryPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allCategories}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <form onSubmit={submitSearch} className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="pl-9"
            />
          </form>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20">
          <Newspaper className="mb-3 size-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <article
              key={a.id}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="relative flex h-36 items-center justify-center bg-muted">
                {a.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverImage || '/placeholder.svg'} alt={a.title} className="h-full w-full object-cover" />
                ) : (
                  <Newspaper className="size-10 text-muted-foreground/30" />
                )}
                <div className="absolute left-2 top-2 flex gap-1.5">
                  {a.status === 'published' ? (
                    <Badge className="border-success/30 bg-success/15 text-success">{t.published}</Badge>
                  ) : (
                    <Badge variant="secondary">{t.draft}</Badge>
                  )}
                  {a.isFeatured && (
                    <Badge className="border-warning/30 bg-warning/15 text-warning">
                      <Star className="size-3" /> {t.featuredBadge}
                    </Badge>
                  )}
                </div>
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="size-7" aria-label={t.actionsAria}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(a)
                          setEditorOpen(true)
                        }}
                      >
                        <Pencil className="size-4" /> {t.edit}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(a)}>
                        {a.status === 'published' ? (
                          <>
                            <EyeOff className="size-4" /> {t.unpublish}
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" /> {t.publish}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleFeatured(a)}>
                        <Star className="size-4" /> {a.isFeatured ? t.featuredRemove : t.featuredAdd}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(a)}>
                        <Trash2 className="size-4" /> {t.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                {a.categoryName && (
                  <span className="text-xs font-medium uppercase tracking-wide text-primary">
                    {a.categoryName}
                  </span>
                )}
                <button
                  onClick={() => {
                    setEditing(a)
                    setEditorOpen(true)
                  }}
                  className="text-left font-semibold leading-snug text-foreground hover:text-primary"
                >
                  {a.title}
                </button>
                {a.excerpt && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{a.excerpt}</p>
                )}
                <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {a.readingMinutes} {t.minutesSuffix}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3.5" /> {a.viewsCount}
                  </span>
                  <span className="ml-auto font-mono">/{a.slug}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

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

      <ArticleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        article={editing}
        categories={categories}
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
