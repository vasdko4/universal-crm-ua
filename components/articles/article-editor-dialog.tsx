'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createArticle, updateArticle, type ArticleInput } from '@/app/actions/articles'
import { slugify } from '@/lib/slug'
import type { Article, ArticleCategory } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

const NONE = 'none'

const empty: ArticleInput = {
  title: '',
  slug: '',
  categoryId: null,
  excerpt: '',
  content: '',
  coverImage: '',
  author: 'Редакция',
  tags: [],
  status: 'draft',
  isFeatured: false,
  readingMinutes: 1,
  metaTitle: '',
  metaDescription: '',
}

export function ArticleEditorDialog({
  open,
  onOpenChange,
  article,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  article: Article | null
  categories: ArticleCategory[]
  onSaved: () => void
}) {
  const { dict } = useAdminI18n()
  const t = dict.articles
  const [form, setForm] = useState<ArticleInput>(empty)
  const [slugTouched, setSlugTouched] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (article) {
      setForm({
        title: article.title,
        slug: article.slug,
        categoryId: article.categoryId,
        excerpt: article.excerpt ?? '',
        content: article.content ?? '',
        coverImage: article.coverImage ?? '',
        author: article.author ?? 'Редакция',
        tags: (article.tags as string[]) ?? [],
        status: article.status as 'draft' | 'published',
        isFeatured: article.isFeatured,
        readingMinutes: article.readingMinutes,
        metaTitle: article.metaTitle ?? '',
        metaDescription: article.metaDescription ?? '',
      })
      setSlugTouched(true)
    } else {
      setForm(empty)
      setSlugTouched(false)
    }
    setTagInput('')
  }, [open, article])

  function set<K extends keyof ArticleInput>(key: K, value: ArticleInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleTitle(value: string) {
    setForm((f) => ({ ...f, title: value, slug: slugTouched ? f.slug : slugify(value) }))
  }

  function addTag() {
    const tag = tagInput.trim()
    if (!tag) return
    if (!(form.tags ?? []).includes(tag)) set('tags', [...(form.tags ?? []), tag])
    setTagInput('')
  }

  function removeTag(tag: string) {
    set('tags', (form.tags ?? []).filter((x) => x !== tag))
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast.error(t.toastTitleRequired)
      return
    }
    startTransition(async () => {
      const result = article ? await updateArticle(article.id, form) : await createArticle(form)
      if (result.success) {
        toast.success(article ? t.toastUpdated : t.toastCreated)
        onSaved()
      } else {
        toast.error(result.error ?? t.toastSaveError)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? t.dialogTitleEdit : t.dialogTitleCreate}</DialogTitle>
          <DialogDescription>{t.dialogDescription}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="content" className="flex-1">{t.tabContent}</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">{t.tabSettings}</TabsTrigger>
            <TabsTrigger value="seo" className="flex-1">{t.tabSeo}</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-title">{t.titleLabel}</Label>
              <Input
                id="art-title"
                value={form.title}
                onChange={(e) => handleTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-slug">{t.slugLabel}</Label>
              <Input
                id="art-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug', e.target.value)
                }}
                className="font-mono"
                placeholder="my-article"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-excerpt">{t.excerptLabel}</Label>
              <Textarea
                id="art-excerpt"
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                rows={2}
                placeholder={t.excerptPlaceholder}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-content">{t.contentLabel}</Label>
              <Textarea
                id="art-content"
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder={t.contentPlaceholder}
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="art-category">{t.categoryLabel}</Label>
                <Select
                  value={form.categoryId ? String(form.categoryId) : NONE}
                  onValueChange={(v) => set('categoryId', v === NONE ? null : Number(v))}
                >
                  <SelectTrigger id="art-category">
                    <SelectValue placeholder={t.noCategory} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t.noCategory}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="art-author">{t.authorLabel}</Label>
                <Input
                  id="art-author"
                  value={form.author ?? ''}
                  onChange={(e) => set('author', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="art-cover">{t.coverLabel}</Label>
                <Input
                  id="art-cover"
                  value={form.coverImage ?? ''}
                  onChange={(e) => set('coverImage', e.target.value)}
                  placeholder="/images/cover.jpg"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="art-reading">{t.readingMinutesLabel}</Label>
                <Input
                  id="art-reading"
                  type="number"
                  min={1}
                  value={form.readingMinutes ?? 1}
                  onChange={(e) => set('readingMinutes', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-tags">{t.tagsLabel}</Label>
              <div className="flex gap-2">
                <Input
                  id="art-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder={t.tagsPlaceholder}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  {t.addTag}
                </Button>
              </div>
              {(form.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(form.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button onClick={() => removeTag(tag)} aria-label={`${t.removeTagAria} ${tag}`}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t.publishLabel}</p>
                <p className="text-xs text-muted-foreground">{t.publishHint}</p>
              </div>
              <Switch
                checked={form.status === 'published'}
                onCheckedChange={(c) => set('status', c ? 'published' : 'draft')}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t.featuredLabel}</p>
                <p className="text-xs text-muted-foreground">{t.featuredHint}</p>
              </div>
              <Switch checked={form.isFeatured} onCheckedChange={(c) => set('isFeatured', c)} />
            </div>
          </TabsContent>

          <TabsContent value="seo" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-meta-title">{t.metaTitleLabel}</Label>
              <Input
                id="art-meta-title"
                value={form.metaTitle ?? ''}
                onChange={(e) => set('metaTitle', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-meta-desc">{t.metaDescLabel}</Label>
              <Textarea
                id="art-meta-desc"
                value={form.metaDescription ?? ''}
                onChange={(e) => set('metaDescription', e.target.value)}
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t.saving : article ? t.save : t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
