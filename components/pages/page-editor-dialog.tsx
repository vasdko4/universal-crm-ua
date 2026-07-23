'use client'

import { useState, useTransition } from 'react'
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
import { useAdminI18n } from '@/lib/i18n/admin/context'

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
  const { dict } = useAdminI18n()
  const t = dict.pages
  const TEMPLATES = [
    { value: 'default', label: t.templateDefault },
    { value: 'contacts', label: t.templateContacts },
    { value: 'faq', label: t.templateFaq },
    { value: 'landing', label: t.templateLanding },
  ]
  const [form, setForm] = useState<PageInput>(empty)
  const [slugTouched, setSlugTouched] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Reset the form whenever the dialog (re-)opens or the page being edited
  // changes, while it's open. Done as a render-time adjustment (comparing
  // against the previous "open state key") instead of an effect, so React
  // doesn't warn about setState calls directly inside an effect body —
  // behavior is identical to the original effect.
  const openKey = open ? (page ? `edit-${page.id}` : 'new') : null
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null)
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (openKey !== null) {
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
    }
  }

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
      toast.error(t.toastTitleRequired)
      return
    }
    startTransition(async () => {
      const result = page ? await updatePage(page.id, form) : await createPage(form)
      if (result.success) {
        toast.success(page ? t.toastUpdated : t.toastCreated)
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
          <DialogTitle>{page ? t.dialogTitleEdit : t.dialogTitleCreate}</DialogTitle>
          <DialogDescription>{t.dialogDescription}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="content" className="flex-1">{t.tabContent}</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">{t.tabSettings}</TabsTrigger>
            <TabsTrigger value="seo" className="flex-1">{t.tabSeo}</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex flex-col gap-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="page-title">{t.titleUk}</Label>
                <Input
                  id="page-title"
                  value={form.title}
                  onChange={(e) => handleTitle(e.target.value)}
                  placeholder={t.titleUkPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="page-title-ru">{t.titleRu}</Label>
                <Input
                  id="page-title-ru"
                  value={form.titleRu ?? ''}
                  onChange={(e) => set('titleRu', e.target.value)}
                  placeholder={t.titleRuPlaceholder}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="page-slug">{t.slugLabel}</Label>
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
                <TabsTrigger value="uk" className="flex-1">{t.langUk}</TabsTrigger>
                <TabsTrigger value="ru" className="flex-1">{t.langRu}</TabsTrigger>
              </TabsList>

              <TabsContent value="uk" className="flex flex-col gap-4 pt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-excerpt-uk">{t.excerptUk}</Label>
                  <Textarea
                    id="page-excerpt-uk"
                    value={form.excerpt}
                    onChange={(e) => set('excerpt', e.target.value)}
                    rows={2}
                    placeholder={t.excerptPlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-content-uk">{t.contentUk}</Label>
                  <Textarea
                    id="page-content-uk"
                    value={form.content}
                    onChange={(e) => set('content', e.target.value)}
                    rows={10}
                    placeholder={t.contentPlaceholder}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>

              <TabsContent value="ru" className="flex flex-col gap-4 pt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-excerpt-ru">{t.excerptRu}</Label>
                  <Textarea
                    id="page-excerpt-ru"
                    value={form.excerptRu ?? ''}
                    onChange={(e) => set('excerptRu', e.target.value)}
                    rows={2}
                    placeholder={t.excerptPlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-content-ru">{t.contentRu}</Label>
                  <Textarea
                    id="page-content-ru"
                    value={form.contentRu ?? ''}
                    onChange={(e) => set('contentRu', e.target.value)}
                    rows={10}
                    placeholder={t.contentPlaceholder}
                    className="font-mono text-sm"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="settings" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="page-template">{t.templateLabel}</Label>
              <Select value={form.template} onValueChange={(v) => set('template', v)}>
                <SelectTrigger id="page-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((tpl) => (
                    <SelectItem key={tpl.value} value={tpl.value}>
                      {tpl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <p className="text-sm font-medium text-foreground">{t.showInMenuLabel}</p>
                <p className="text-xs text-muted-foreground">{t.showInMenuHint}</p>
              </div>
              <Switch checked={form.showInMenu} onCheckedChange={(c) => set('showInMenu', c)} />
            </div>
            {form.showInMenu && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-menu-title">{t.menuTitleLabel}</Label>
                  <Input
                    id="page-menu-title"
                    value={form.menuTitle ?? ''}
                    onChange={(e) => set('menuTitle', e.target.value)}
                    placeholder={form.title}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="page-sort">{t.sortOrderLabel}</Label>
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
              <Label htmlFor="page-meta-title">{t.metaTitleLabel}</Label>
              <Input
                id="page-meta-title"
                value={form.metaTitle ?? ''}
                onChange={(e) => set('metaTitle', e.target.value)}
                placeholder={t.metaTitlePlaceholder}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="page-meta-desc">{t.metaDescLabel}</Label>
              <Textarea
                id="page-meta-desc"
                value={form.metaDescription ?? ''}
                onChange={(e) => set('metaDescription', e.target.value)}
                rows={3}
                placeholder={t.metaDescPlaceholder}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? t.saving : page ? t.save : t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
