'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createPage, updatePage, type PageInput } from '@/app/actions/pages'
import { slugify } from '@/lib/slug'
import type { Page } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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

const TEMPLATES = [
  { value: 'default', label: 'Обычная страница' },
  { value: 'contacts', label: 'Контакты' },
  { value: 'faq', label: 'Вопрос-ответ (FAQ)' },
  { value: 'landing', label: 'Лендинг' },
]

const empty: PageInput = {
  title: '',
  titleRu: '',
  slug: '',
  content: '',
  contentRu: '',
  excerpt: '',
  excerptRu: '',
  template: 'default',
  status: 'draft',
  showInMenu: false,
  menuTitle: '',
  sortOrder: 0,
  metaTitle: '',
  metaDescription: '',
}

export function PageEditorDialog({
  open,
  onOpenChange,
  page,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  page: Page | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<PageInput>(empty)
  const [slugTouched, setSlugTouched] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (page) {
      setForm({
        title: page.title,
        titleRu: page.titleRu ?? '',
        slug: page.slug,
        content: page.content ?? '',
        contentRu: page.contentRu ?? '',
        excerpt: page.excerpt ?? '',
        excerptRu: page.excerptRu ?? '',
        template: page.template,
        status: page.status as 'draft' | 'published',
        showInMenu: page.showInMenu,
        menuTitle: page.menuTitle ?? '',
        sortOrder: page.sortOrder,
        metaTitle: page.metaTitle ?? '',
        metaDescription: page.metaDescription ?? '',
      })
      setSlugTouched(true)
    } else {
      setForm(empty)
      setSlugTouched(false)
    }
  }, [open, page])

  function set<K extends keyof PageInput>(key: K, value: PageInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleTitle(value: string) {
    setForm((f) => ({
      ...f,
      title: value,
      slug: slugTouched ? f.slug : slugify(value),
    }))
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast.error('Введите заголовок страницы')
      return
    }
    startTransition(async () => {
      const result = page ? await updatePage(page.id, form) : await createPage(form)
      if (result.success) {
        toast.success(page ? 'Страница обновлена' : 'Страница создана')
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
          <DialogTitle>{page ? 'Редактирование страницы' : 'Новая страница'}</DialogTitle>
          <DialogDescription>Заполните содержимое и настройки отображения.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="content" className="flex-1">Содержимое</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Настройки</TabsTrigger>
            <TabsTrigger value="seo" className="flex-1">SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex flex-col gap-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="page-title">Заголовок (Укр)</Label>
                <Input
                  id="page-title"
                  value={form.title}
                  onChange={(e) => handleTitle(e.target.value)}
                  placeholder="Наприклад: Про компанію"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="page-title-ru">Заголовок (Рус)</Label>
                <Input
                  id="page-title-ru"
                  value={form.titleRu ?? ''}
                  onChange={(e) => set('titleRu', e.target.value)}
                  placeholder="Например: О компании"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="page-slug">URL (slug)</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/</span>
                <Input
                  id="page-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug', e.target.value)
                  }}
                  placeholder="about"
                  className="font-mono"
                />
              </div>
            </div>
            <Tabs defaultValue="uk" className="mt-1">
              <TabsList className="w-full">
                <TabsTrigger value="uk" className="flex-1">Українська</TabsTrigger>
                <TabsTrigger value="ru" className="flex-1">Русский</TabsTrigger>
              </TabsList>

              <TabsContent value="uk" className="flex flex-col gap-4 pt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-excerpt-uk">Короткий опис (Укр)</Label>
                  <Textarea
                    id="page-excerpt-uk"
                    value={form.excerpt}
                    onChange={(e) => set('excerpt', e.target.value)}
                    rows={2}
                    placeholder="Короткий анонс сторінки"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-content-uk">Вміст, Укр (HTML)</Label>
                  <Textarea
                    id="page-content-uk"
                    value={form.content}
                    onChange={(e) => set('content', e.target.value)}
                    rows={10}
                    placeholder="<h2>Заголовок</h2><p>Текст...</p>"
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="ru" className="flex flex-col gap-4 pt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-excerpt-ru">Краткое описание (Рус)</Label>
                  <Textarea
                    id="page-excerpt-ru"
                    value={form.excerptRu ?? ''}
                    onChange={(e) => set('excerptRu', e.target.value)}
                    rows={2}
                    placeholder="Короткий анонс страницы"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-content-ru">Содержимое, Рус (HTML)</Label>
                  <Textarea
                    id="page-content-ru"
                    value={form.contentRu ?? ''}
                    onChange={(e) => set('contentRu', e.target.value)}
                    rows={10}
                    placeholder="<h2>Заголовок</h2><p>Текст...</p>"
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="settings" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="page-template">Шаблон</Label>
              <Select value={form.template} onValueChange={(v) => set('template', v)}>
                <SelectTrigger id="page-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Опубликовать</p>
                <p className="text-xs text-muted-foreground">Страница будет видна на сайте</p>
              </div>
              <Switch
                checked={form.status === 'published'}
                onCheckedChange={(c) => set('status', c ? 'published' : 'draft')}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Показывать в меню</p>
                <p className="text-xs text-muted-foreground">Добавить ссылку в навигацию</p>
              </div>
              <Switch checked={form.showInMenu} onCheckedChange={(c) => set('showInMenu', c)} />
            </div>
            {form.showInMenu && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-menu-title">Название в меню</Label>
                  <Input
                    id="page-menu-title"
                    value={form.menuTitle ?? ''}
                    onChange={(e) => set('menuTitle', e.target.value)}
                    placeholder={form.title}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-sort">Порядок</Label>
                  <Input
                    id="page-sort"
                    type="number"
                    value={form.sortOrder ?? 0}
                    onChange={(e) => set('sortOrder', Number(e.target.value))}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="seo" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="page-meta-title">Meta Title</Label>
              <Input
                id="page-meta-title"
                value={form.metaTitle ?? ''}
                onChange={(e) => set('metaTitle', e.target.value)}
                placeholder="Заголовок для поисковых систем"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="page-meta-desc">Meta Description</Label>
              <Textarea
                id="page-meta-desc"
                value={form.metaDescription ?? ''}
                onChange={(e) => set('metaDescription', e.target.value)}
                rows={3}
                placeholder="Описание для сниппета в поиске"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Сохранение...' : page ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
