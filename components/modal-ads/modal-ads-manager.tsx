'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { ModalAd } from '@/lib/db/schema'
import {
  createModalAd,
  updateModalAd,
  toggleModalAdActive,
  deleteModalAd,
  resetModalAdStats,
  type ModalAdInput,
  type ModalAdTargetPage,
} from '@/app/actions/modal-ads'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ImageUploader } from '@/components/products/image-uploader'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Megaphone,
  MoreVertical,
  Trash2,
  Pencil,
  Eye,
  MousePointerClick,
  X,
  RotateCcw,
  Loader2,
  Timer,
  MoveVertical,
  LogOut,
} from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type Data = {
  items: ModalAd[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// '' = theme primary color; anything else is a hex applied inline.
const BUTTON_COLOR_KEYS = ['', '#e11d48', '#ea580c', '#16a34a', '#2563eb', '#111111'] as const

// Readable text (black/white) for an arbitrary hex background.
function contrastText(hex: string): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return '#ffffff'
  const n = Number.parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111111' : '#ffffff'
}

function formatDate(d: Date | string | null) {
  if (!d) return null
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
}

function toLocalInput(d: Date | string | null): string {
  if (!d) return ''
  const date = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ctr(views: number, clicks: number): string {
  if (!views) return '0%'
  return `${Math.round((clicks / views) * 1000) / 10}%`
}

type FormState = {
  name: string
  title: string
  body: string
  imageUrl: string
  buttonText: string
  buttonUrl: string
  buttonColor: string
  targetPages: ModalAdTargetPage[]
  triggerType: 'delay' | 'scroll' | 'exit'
  triggerValue: string
  frequency: 'every' | 'session' | 'days'
  frequencyDays: string
  size: 'small' | 'medium' | 'large'
  startsAt: string
  endsAt: string
  isActive: boolean
}

const emptyForm = (): FormState => ({
  name: '',
  title: '',
  body: '',
  imageUrl: '',
  buttonText: '',
  buttonUrl: '',
  buttonColor: '',
  targetPages: ['all'],
  triggerType: 'delay',
  triggerValue: '5',
  frequency: 'session',
  frequencyDays: '7',
  size: 'medium',
  startsAt: toLocalInput(new Date()),
  endsAt: '',
  isActive: true,
})

const fromAd = (ad: ModalAd): FormState => ({
  name: ad.name,
  title: ad.title,
  body: ad.body ?? '',
  imageUrl: ad.imageUrl ?? '',
  buttonText: ad.buttonText ?? '',
  buttonUrl: ad.buttonUrl ?? '',
  buttonColor: ad.buttonColor ?? '',
  targetPages: (ad.targetPages as ModalAdTargetPage[]) ?? ['all'],
  triggerType: ad.triggerType as FormState['triggerType'],
  triggerValue: String(ad.triggerValue),
  frequency: ad.frequency as FormState['frequency'],
  frequencyDays: String(ad.frequencyDays),
  size: ad.size as FormState['size'],
  startsAt: toLocalInput(ad.startsAt),
  endsAt: toLocalInput(ad.endsAt),
  isActive: ad.isActive,
})

export function ModalAdsManager({
  data,
  search,
  status,
}: {
  data: Data
  search: string
  status: 'all' | 'active' | 'inactive'
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { dict } = useAdminI18n()
  const t = dict.modalAds
  const [query, setQuery] = useState(search)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const statusTabs = [
    { key: 'all' as const, label: t.tabAll },
    { key: 'active' as const, label: t.tabActive },
    { key: 'inactive' as const, label: t.tabInactive },
  ]

  const PAGE_OPTIONS: { key: ModalAdTargetPage; label: string }[] = [
    { key: 'all', label: t.pageAll },
    { key: 'home', label: t.pageHome },
    { key: 'catalog', label: t.pageCatalog },
    { key: 'product', label: t.pageProduct },
    { key: 'cart', label: t.pageCart },
  ]

  const TRIGGERS = [
    { key: 'delay' as const, label: t.triggerDelay, hint: t.triggerDelayHint, icon: Timer },
    { key: 'scroll' as const, label: t.triggerScroll, hint: t.triggerScrollHint, icon: MoveVertical },
    { key: 'exit' as const, label: t.triggerExit, hint: t.triggerExitHint, icon: LogOut },
  ]

  const FREQUENCIES = [
    { key: 'every' as const, label: t.freqEvery },
    { key: 'session' as const, label: t.freqSession },
    { key: 'days' as const, label: t.freqDays },
  ]

  const SIZES = [
    { key: 'small' as const, label: t.sizeSmall },
    { key: 'medium' as const, label: t.sizeMedium },
    { key: 'large' as const, label: t.sizeLarge },
  ]

  const BUTTON_COLOR_LABELS: Record<string, string> = {
    '': t.colorTheme,
    '#e11d48': t.colorRed,
    '#ea580c': t.colorOrange,
    '#16a34a': t.colorGreen,
    '#2563eb': t.colorBlue,
    '#111111': t.colorBlack,
  }
  const BUTTON_COLORS = BUTTON_COLOR_KEYS.map((key) => ({ key, label: BUTTON_COLOR_LABELS[key] }))

  const navigate = (params: Record<string, string>) => {
    const sp = new URLSearchParams()
    const q = params.q ?? query
    const st = params.status ?? status
    if (q) sp.set('q', q)
    if (st !== 'all') sp.set('status', st)
    if (params.page && params.page !== '1') sp.set('page', params.page)
    startTransition(() => router.push(`/admin/modal-ads?${sp.toString()}`))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormOpen(true)
  }

  const openEdit = (ad: ModalAd) => {
    setEditingId(ad.id)
    setForm(fromAd(ad))
    setFormOpen(true)
  }

  const togglePage = (key: ModalAdTargetPage) => {
    setForm((f) => {
      if (key === 'all') return { ...f, targetPages: ['all'] }
      const withoutAll = f.targetPages.filter((p) => p !== 'all')
      const next = withoutAll.includes(key) ? withoutAll.filter((p) => p !== key) : [...withoutAll, key]
      return { ...f, targetPages: next.length ? next : ['all'] }
    })
  }

  const submit = async () => {
    setSaving(true)
    const input: ModalAdInput = {
      name: form.name,
      title: form.title,
      body: form.body || null,
      imageUrl: form.imageUrl || null,
      buttonText: form.buttonText || null,
      buttonUrl: form.buttonUrl || null,
      buttonColor: form.buttonColor || null,
      targetPages: form.targetPages,
      triggerType: form.triggerType,
      triggerValue: Number(form.triggerValue) || 0,
      frequency: form.frequency,
      frequencyDays: Number(form.frequencyDays) || 7,
      size: form.size,
      startsAt: form.startsAt || new Date().toISOString(),
      endsAt: form.endsAt || null,
      isActive: form.isActive,
    }
    const res = editingId ? await updateModalAd(editingId, input) : await createModalAd(input)
    setSaving(false)
    if (!res.success) {
      toast.error(res.error ?? t.toastSaveError)
      return
    }
    toast.success(editingId ? t.toastUpdated : t.toastCreated)
    setFormOpen(false)
    router.refresh()
  }

  const onToggle = (ad: ModalAd) => {
    startTransition(async () => {
      await toggleModalAdActive(ad.id, !ad.isActive)
      router.refresh()
    })
  }

  const onDelete = async () => {
    if (deleteId == null) return
    await deleteModalAd(deleteId)
    setDeleteId(null)
    toast.success(t.toastDeleted)
    router.refresh()
  }

  const onResetStats = (id: number) => {
    startTransition(async () => {
      await resetModalAdStats(id)
      toast.success(t.toastStatsReset)
      router.refresh()
    })
  }

  const totals = data.items.reduce(
    (acc, ad) => ({
      views: acc.views + ad.viewsCount,
      clicks: acc.clicks + ad.clicksCount,
      closes: acc.closes + ad.closesCount,
    }),
    { views: 0, clicks: 0, closes: 0 },
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t.newCampaign}
        </Button>
      </header>

      {/* Aggregate analytics for the visible page */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Megaphone className="size-4" />} label={t.statCampaigns} value={String(data.total)} />
        <StatCard icon={<Eye className="size-4" />} label={t.statViews} value={String(totals.views)} />
        <StatCard icon={<MousePointerClick className="size-4" />} label={t.statClicks} value={String(totals.clicks)} />
        <StatCard icon={<X className="size-4" />} label={t.statCtr} value={ctr(totals.views, totals.clicks)} />
      </div>

      {/* Search + status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            navigate({ q: query, page: '1' })
          }}
        >
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9"
          />
        </form>
        <div className="flex rounded-lg border border-border p-0.5">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate({ status: tab.key, page: '1' })}
              className={
                'rounded-md px-3 py-1.5 text-sm transition-colors ' +
                (status === tab.key ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign list */}
      {data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Megaphone className="size-8 text-muted-foreground" />
          <p className="font-medium text-foreground">{t.empty}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t.emptyHint}</p>
          <Button onClick={openCreate} variant="outline" size="sm">
            <Plus className="size-4" />
            {t.createCampaign}
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((ad) => {
            const trigger = TRIGGERS.find((tr) => tr.key === ad.triggerType)
            const pages = (ad.targetPages as string[])
              .map((p) => PAGE_OPTIONS.find((o) => o.key === p)?.label ?? p)
              .join(', ')
            return (
              <li key={ad.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {ad.imageUrl ? (
                      <Image
                        src={ad.imageUrl || '/placeholder.svg'}
                        alt=""
                        width={56}
                        height={56}
                        className="size-14 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                        <Megaphone className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{ad.name}</p>
                        <Badge variant={ad.isActive ? 'default' : 'secondary'}>
                          {ad.isActive ? t.active : t.inactive}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">«{ad.title}»</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {trigger?.label.toLowerCase()}
                        {ad.triggerType === 'delay' && ` · ${ad.triggerValue} ${t.secSuffix}`}
                        {ad.triggerType === 'scroll' && ` · ${ad.triggerValue}%`}
                        {' · '}
                        {pages}
                        {` · ${t.sinceLabel} `}
                        {formatDate(ad.startsAt)}
                        {ad.endsAt ? ` ${t.untilLabel} ${formatDate(ad.endsAt)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ad.isActive}
                      onCheckedChange={() => onToggle(ad)}
                      disabled={isPending}
                      aria-label={t.enableCampaignAria}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t.actionsAria}>
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(ad)}>
                          <Pencil className="size-4" />
                          {t.edit}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onResetStats(ad.id)}>
                          <RotateCcw className="size-4" />
                          {t.resetStats}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(ad.id)}>
                          <Trash2 className="size-4" />
                          {t.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Per-campaign analytics */}
                <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm sm:grid-cols-4">
                  <AdStat label={t.statViewsShort} value={String(ad.viewsCount)} />
                  <AdStat label={t.statClicksShort} value={String(ad.clicksCount)} />
                  <AdStat label={t.statCtr} value={ctr(ad.viewsCount, ad.clicksCount)} />
                  <AdStat label={t.statClosesShort} value={String(ad.closesCount)} />
                </dl>
              </li>
            )
          })}
        </ul>
      )}

      {/* Pagination */}
      {data.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label={t.paginationAria}>
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === data.page ? 'default' : 'outline'}
              size="sm"
              onClick={() => navigate({ page: String(p) })}
            >
              {p}
            </Button>
          ))}
        </nav>
      )}

      {/* Create / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t.dialogTitleEdit : t.dialogTitleCreate}</DialogTitle>
            <DialogDescription>{t.dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">{t.sectionContent}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ma-name">{t.campaignNameLabel}</Label>
                  <Input
                    id="ma-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t.campaignNamePlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ma-title">{t.bannerTitleLabel}</Label>
                  <Input
                    id="ma-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={t.bannerTitlePlaceholder}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ma-body">{t.textLabel}</Label>
                <Textarea
                  id="ma-body"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder={t.textPlaceholder}
                  rows={2}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{t.bannerImageLabel}</Label>
                  <ImageUploader
                    value={form.imageUrl || null}
                    onChange={(url) => setForm({ ...form, imageUrl: url ?? '' })}
                  />
                  <p className="text-xs text-muted-foreground">{t.bannerImageHint}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t.windowSizeLabel}</Label>
                  <div className="flex rounded-lg border border-border p-0.5">
                    {SIZES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setForm({ ...form, size: s.key })}
                        className={
                          'flex-1 rounded-md px-2 py-1.5 text-sm transition-colors ' +
                          (form.size === s.key
                            ? 'bg-secondary font-medium text-foreground'
                            : 'text-muted-foreground hover:text-foreground')
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ma-btn-text">{t.buttonTextLabel}</Label>
                  <Input
                    id="ma-btn-text"
                    value={form.buttonText}
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                    placeholder={t.buttonTextPlaceholder}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ma-btn-url">{t.buttonUrlLabel}</Label>
                  <Input
                    id="ma-btn-url"
                    value={form.buttonUrl}
                    onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                    placeholder="/catalog"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t.buttonColorLabel}</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {BUTTON_COLORS.map((c) => (
                    <button
                      key={c.key || 'theme'}
                      type="button"
                      onClick={() => setForm({ ...form, buttonColor: c.key })}
                      aria-label={c.label}
                      title={c.label}
                      className={
                        'flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ' +
                        (form.buttonColor === c.key
                          ? 'border-primary font-medium text-foreground ring-1 ring-primary'
                          : 'border-border text-muted-foreground hover:text-foreground')
                      }
                    >
                      <span
                        aria-hidden
                        className="size-4 rounded-full border border-border"
                        style={c.key ? { backgroundColor: c.key } : undefined}
                      />
                      {c.label}
                    </button>
                  ))}
                  <label
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    title={t.customColorLabel}
                  >
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(form.buttonColor) ? form.buttonColor : '#2563eb'}
                      onChange={(e) => setForm({ ...form, buttonColor: e.target.value })}
                      className="size-4 cursor-pointer appearance-none border-0 bg-transparent p-0"
                      aria-label={t.customColorAria}
                    />
                    {t.customColorLabel}
                  </label>
                </div>
                {form.buttonText && (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-border p-3">
                    <span className="text-xs text-muted-foreground">{t.previewLabel}</span>
                    <span
                      className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold"
                      style={
                        form.buttonColor
                          ? { backgroundColor: form.buttonColor, color: contrastText(form.buttonColor) }
                          : { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }
                      }
                    >
                      {form.buttonText}
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">{t.sectionWhereToShow}</h3>
              <div className="flex flex-wrap gap-2">
                {PAGE_OPTIONS.map((p) => {
                  const active = form.targetPages.includes(p.key)
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePage(p.key)}
                      className={
                        'rounded-full border px-3 py-1.5 text-sm transition-colors ' +
                        (active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground')
                      }
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">{t.sectionTrigger}</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {TRIGGERS.map((tr) => (
                  <button
                    key={tr.key}
                    type="button"
                    onClick={() => setForm({ ...form, triggerType: tr.key })}
                    className={
                      'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ' +
                      (form.triggerType === tr.key ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40')
                    }
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <tr.icon className="size-4" />
                      {tr.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{tr.hint}</span>
                  </button>
                ))}
              </div>
              {form.triggerType !== 'exit' && (
                <div className="flex items-center gap-3">
                  <Label htmlFor="ma-trigger-value" className="shrink-0">
                    {form.triggerType === 'delay' ? t.delaySecondsLabel : t.scrollPercentLabel}
                  </Label>
                  <Input
                    id="ma-trigger-value"
                    type="number"
                    min={form.triggerType === 'delay' ? 0 : 1}
                    max={form.triggerType === 'delay' ? 300 : 100}
                    value={form.triggerValue}
                    onChange={(e) => setForm({ ...form, triggerValue: e.target.value })}
                    className="w-28"
                  />
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">{t.sectionFrequency}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-lg border border-border p-0.5">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setForm({ ...form, frequency: f.key })}
                      className={
                        'rounded-md px-3 py-1.5 text-sm transition-colors ' +
                        (form.frequency === f.key
                          ? 'bg-secondary font-medium text-foreground'
                          : 'text-muted-foreground hover:text-foreground')
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {form.frequency === 'days' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={form.frequencyDays}
                      onChange={(e) => setForm({ ...form, frequencyDays: e.target.value })}
                      className="w-20"
                      aria-label={t.daysBetweenAria}
                    />
                    <span className="text-sm text-muted-foreground">{t.daysSuffix}</span>
                  </div>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-foreground">{t.sectionSchedule}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ma-starts">{t.startLabel}</Label>
                  <Input
                    id="ma-starts"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ma-ends">{t.endLabel}</Label>
                  <Input
                    id="ma-ends"
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="ma-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label htmlFor="ma-active">{t.campaignEnabledLabel}</Label>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t.cancel}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? t.save : t.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onDelete}
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        {icon}
      </span>
      <div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function AdStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
