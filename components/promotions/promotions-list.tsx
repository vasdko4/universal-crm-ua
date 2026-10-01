'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Promotion } from '@/lib/db/schema'
import {
  togglePromotionActive,
  deletePromotion,
} from '@/app/actions/promotions'
import {
  Search,
  Plus,
  Percent,
  Tag,
  Ticket,
  MoreVertical,
  Trash2,
  Copy,
  Calendar,
  TrendingUp,
  Pencil,
  Sparkles,
} from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import type { AdminDictionary } from '@/lib/i18n/admin/dictionaries'

type Data = {
  items: Promotion[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function statusTabs(t: AdminDictionary) {
  return [
    { key: 'all', label: t.promotions.tabAll },
    { key: 'active', label: t.promotions.tabActive },
    { key: 'inactive', label: t.promotions.tabInactive },
  ] as const
}

function numberTag(locale: string) {
  return locale === 'ru' ? 'ru-RU' : 'uk-UA'
}

function formatMoney(v: number, locale: string = 'uk') {
  return new Intl.NumberFormat(numberTag(locale), { maximumFractionDigits: 0 }).format(v)
}

function formatDate(d: Date | string | null, locale: string = 'uk') {
  if (!d) return null
  return new Intl.DateTimeFormat(numberTag(locale), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(d),
  )
}

export function PromotionsList({
  data,
  totalCount,
  search,
  status,
}: {
  data: Data
  totalCount: number
  search: string
  status: 'all' | 'active' | 'inactive'
}) {
  const { dict: t, locale } = useAdminI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(search)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  function pushParams(next: { q?: string; status?: string; page?: number }) {
    const params = new URLSearchParams()
    const q = next.q ?? query
    const st = next.status ?? status
    const page = next.page ?? 1
    if (q) params.set('q', q)
    if (st && st !== 'all') params.set('status', st)
    if (page > 1) params.set('page', String(page))
    startTransition(() => router.push(`/admin/promotions?${params.toString()}`))
  }

  function handleToggle(id: number, value: boolean) {
    startTransition(async () => {
      await togglePromotionActive(id, value)
      toast.success(value ? t.promotions.toastActivated : t.promotions.toastDeactivated)
      router.refresh()
    })
  }

  function handleDelete() {
    if (deleteId == null) return
    const id = deleteId
    setDeleteId(null)
    startTransition(async () => {
      await deletePromotion(id)
      toast.success(t.promotions.toastDeleted)
      router.refresh()
    })
  }

  // Пустое состояние: во всей системе нет ни одной акции
  if (totalCount === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Hero totalCount={0} />
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="relative mb-6">
            <div aria-hidden className="absolute inset-0 -m-6 rounded-full bg-gradient-to-br from-violet-200 via-fuchsia-100 to-orange-100 blur-2xl" />
            <div className="relative size-48">
              <Image
                src="/promotions-empty.png"
                alt=""
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{t.promotions.emptyTitle}</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">{t.promotions.emptyDesc}</p>
          <Link
            href="/admin/promotions/new"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:shadow-xl hover:shadow-violet-600/30 hover:brightness-110"
          >
            <Plus className="size-4" />
            {t.promotions.addButton}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Hero totalCount={totalCount} />

      <div className="px-4 py-6 sm:px-6">
        {/* Панель поиска и фильтров */}
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {statusTabs(t).map((tab) => (
              <button
                key={tab.key}
                onClick={() => pushParams({ status: tab.key, page: 1 })}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                  status === tab.key
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              pushParams({ q: query, page: 1 })
            }}
            className="relative flex-1 sm:max-w-xs"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.promotions.searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
            />
          </form>
        </div>

        {/* Список */}
        {data.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
            <p className="text-sm text-slate-500">{t.promotions.noResults}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {data.items.map((p) => (
              <PromotionCard
                key={p.id}
                promotion={p}
                busy={isPending}
                onToggle={handleToggle}
                onDelete={() => setDeleteId(p.id)}
              />
            ))}
          </div>
        )}

        {/* Пагинация */}
        {data.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => pushParams({ page: n })}
                className={`size-9 rounded-xl text-sm font-medium transition-all ${
                  n === data.page
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/25'
                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:ring-violet-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.promotions.deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.promotions.deleteDialogDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Hero({ totalCount }: { totalCount: number }) {
  const { dict: t } = useAdminI18n()
  return (
    <header className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-purple-700 to-fuchsia-700">
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 right-10 size-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute right-1/4 top-0 size-40 rounded-full bg-orange-300/10 blur-2xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4 px-4 py-7 sm:px-6 sm:py-8">
        <div className="flex items-center gap-4">
          <span className="hidden size-12 items-center justify-center rounded-2xl bg-white/15 text-white shadow-inner backdrop-blur-sm sm:flex">
            <Sparkles className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">{t.promotions.pageTitle}</h1>
            <p className="mt-0.5 text-sm text-white/75">{t.promotions.pageSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm sm:flex">
            <span className="text-2xl font-bold text-white">{totalCount}</span>
            <span className="text-xs leading-tight text-white/70">{t.promotions.statTotal}</span>
          </div>
          <Link
            href="/admin/promotions/new"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-violet-700 shadow-lg transition-all hover:bg-violet-50 hover:shadow-xl"
          >
            <Plus className="size-4" />
            {t.promotions.addButton}
          </Link>
        </div>
      </div>
    </header>
  )
}

function PromotionCard({
  promotion: p,
  busy,
  onToggle,
  onDelete,
}: {
  promotion: Promotion
  busy: boolean
  onToggle: (id: number, value: boolean) => void
  onDelete: () => void
}) {
  const { dict: t, locale } = useAdminI18n()
  async function copyPromoCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(t.promotions.toastCodeCopied)
    } catch {
      toast.error(t.promotions.toastCodeCopyFailed)
    }
  }

  const isPromo = p.type === 'promocode'
  const discount =
    p.discountType === 'percentage'
      ? `${Number(p.discountValue)}%`
      : `${formatMoney(Number(p.discountValue), locale)} ₴`
  const targetLabel =
    p.targetType === 'all'
      ? t.promotions.targetAll
      : p.targetType === 'groups'
        ? t.promotions.targetGroups
        : t.promotions.targetProducts
  const start = formatDate(p.startsAt, locale)
  const end = formatDate(p.endsAt, locale)
  const usagePct =
    p.usageLimit && p.usageLimit > 0
      ? Math.min(100, Math.round(((p.usedCount ?? 0) / p.usageLimit) * 100))
      : null

  return (
    <div
      className={`group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-600/5 ${
        p.isActive ? 'border-slate-200' : 'border-slate-200 opacity-75'
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 ${
          isPromo
            ? 'bg-gradient-to-b from-violet-500 to-fuchsia-500'
            : 'bg-gradient-to-b from-amber-400 to-orange-500'
        }`}
      />

      <div
        className={`flex size-13 shrink-0 items-center justify-center rounded-2xl text-white shadow-md ${
          isPromo
            ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/25'
            : 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/25'
        }`}
      >
        {isPromo ? <Ticket className="size-6" /> : <Tag className="size-6" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/promotions/${p.id}/edit`}
            className="truncate font-bold text-slate-900 hover:text-violet-700"
          >
            {p.name}
          </Link>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white shadow-sm ${
              isPromo
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600'
                : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
          >
            <Percent className="size-3" />
            {discount}
          </span>
          {p.promoCode && (
            <button
              type="button"
              onClick={() => copyPromoCode(p.promoCode!)}
              title={t.promotions.copyCodeAction}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-200"
            >
              <Copy className="size-3 opacity-60" />
              {p.promoCode}
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
            />
            {p.isActive ? t.promotions.tabActive : t.promotions.tabInactive}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{targetLabel}</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" />
            {start}
            {end ? ` – ${end}` : ` · ${t.promotions.noEndDate}`}
          </span>
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="size-3" />
            {t.promotions.usedLabel}: {p.usedCount}
            {p.usageLimit ? ` / ${p.usageLimit}` : ''}
          </span>
        </div>

        {usagePct != null && (
          <div className="mt-2 flex max-w-xs items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePct >= 90
                    ? 'bg-gradient-to-r from-red-500 to-orange-500'
                    : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-400">{usagePct}%</span>
          </div>
        )}
      </div>

      <div className="hidden shrink-0 text-right lg:block">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{t.promotions.totalDiscountLabel}</p>
        <p className="font-bold text-slate-900">{formatMoney(Number(p.totalDiscountAmount), locale)} ₴</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Switch
          checked={!!p.isActive}
          disabled={busy}
          onCheckedChange={(v) => onToggle(p.id, v)}
          aria-label={t.promotions.statusSr}
          className="data-[state=checked]:bg-violet-600"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label={t.promotions.actionsAria}
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/promotions/${p.id}/edit`}>
                <Pencil className="size-4" />
                {t.common.edit}
              </Link>
            </DropdownMenuItem>
            {p.promoCode && (
              <DropdownMenuItem
                onClick={() => copyPromoCode(p.promoCode!)}
              >
                <Copy className="size-4" />
                {t.promotions.copyCodeAction}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="size-4" />
              {t.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
