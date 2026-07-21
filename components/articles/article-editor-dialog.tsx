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
    const t = tagInput.trim()
    if (!t) return
    if (!(form.tags ?? []).includes(t)) set('tags', [...(form.tags ?? []), t])
    setTagInput('')
  }

  function removeTag(t: string) {
    set('tags', (form.tags ?? []).filter((x) => x !== t))
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast.error('Введите заголовок статьи')
      return
    }
    startTransition(async () => {
      const result = article ? await updateArticle(article.id, form) : await createArticle(form)
      if (result.success) {
        toast.success(article ? 'Статья обновлена' : 'Статья создана')
        onSaved()
      } else {
        toast.error(result.error ?? 'Ошибка сохранения')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? 'Редактирование статьи' : 'Новая статья'}</DialogTitle>
          <DialogDescription>Напишите материал и настройте публикацию.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="content" className="flex-1">Содержимое</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Настройки</TabsTrigger>
            <TabsTrigger value="seo" className="flex-1">SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-title">Заголовок</Label>
              <Input
                id="art-title"
                value={form.title}
                onChange={(e) => handleTitle(e.target.value)}
                placeholder="Заголовок статьи"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-slug">URL (slug)</Label>
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
              <Label htmlFor="art-excerpt">Краткое описание</Label>
              <Textarea
                id="art-excerpt"
                value={form.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
                rows={2}
                placeholder="Анонс статьи для карточки и списков"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-content">Содержимое (HTML)</Label>
              <Textarea
                id="art-content"
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder="<p>Текст статьи...</p>"
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="art-category">Категория</Label>
                <Select
                  value={form.categoryId ? String(form.categoryId) : NONE}
                  onValueChange={(v) => set('categoryId', v === NONE ? null : Number(v))}
                >
                  <SelectTrigger id="art-category">
                    <SelectValue placeholder="Без категории" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Без категории</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="art-author">Автор</Label>
                <Input
                  id="art-author"
                  value={form.author ?? ''}
                  onChange={(e) => set('author', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="art-cover">Ссылка на обложку</Label>
                <Input
                  id="art-cover"
                  value={form.coverImage ?? ''}
                  onChange={(e) => set('coverImage', e.target.value)}
                  placeholder="/images/cover.jpg"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="art-reading">Время чтения (мин)</Label>
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
              <Label htmlFor="art-tags">Теги</Label>
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
                  placeholder="Добавить тег и Enter"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Добавить
                </Button>
              </div>
              {(form.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(form.tags ?? []).map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1">
                      {t}
                      <button onClick={() => removeTag(t)} aria-label={`Удалить тег ${t}`}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Опубликовать</p>
                <p className="text-xs text-muted-foreground">Статья будет видна на сайте</p>
              </div>
              <Switch
                checked={form.status === 'published'}
                onCheckedChange={(c) => set('status', c ? 'published' : 'draft')}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Рекомендованная</p>
                <p className="text-xs text-muted-foreground">Показывать в блоке «Топ»</p>
              </div>
              <Switch checked={form.isFeatured} onCheckedChange={(c) => set('isFeatured', c)} />
            </div>
          </TabsContent>

          <TabsContent value="seo" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-meta-title">Meta Title</Label>
              <Input
                id="art-meta-title"
                value={form.metaTitle ?? ''}
                onChange={(e) => set('metaTitle', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="art-meta-desc">Meta Description</Label>
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
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Сохранение...' : article ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
