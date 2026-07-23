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

function formatMoney(v: number) {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(v)
}

function formatDate(d: Date | string | null) {
  if (!d) return null
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
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
  const { dict: t } = useAdminI18n()
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
        <Header />
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="relative mb-6 size-48">
            <Image
              src="/promotions-empty.png"
              alt=""
              fill
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">{t.promotions.emptyTitle}</h2>
          <p className="mt-2 max-w-sm text-sm text-slate-500">{t.promotions.emptyDesc}</p>
          <Link
            href="/admin/promotions/new"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
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
      <Header />

      <div className="px-6 py-6">
        {/* Панель поиска и фильтров */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {statusTabs(t).map((tab) => (
              <button
                key={tab.key}
                onClick={() => pushParams({ status: tab.key, page: 1 })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  status === tab.key
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
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
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </form>
        </div>

        {/* Список */}
        {data.items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
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
          <div className="mt-6 flex items-center justify-center gap-1">
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => pushParams({ page: n })}
                className={`size-9 rounded-lg text-sm font-medium transition-colors ${
                  n === data.page
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100'
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

function Header() {
  const { dict: t } = useAdminI18n()
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{t.promotions.pageTitle}</h1>
        <p className="text-sm text-slate-500">{t.promotions.pageSubtitle}</p>
      </div>
      <Link
        href="/admin/promotions/new"
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700"
      >
        <Plus className="size-4" />
        {t.promotions.addButton}
      </Link>
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
  const { dict: t } = useAdminI18n()
  const discount =
    p.discountType === 'percentage'
      ? `${Number(p.discountValue)}%`
      : `${formatMoney(Number(p.discountValue))} ₴`
  const targetLabel =
    p.targetType === 'all'
      ? t.promotions.targetAll
      : p.targetType === 'groups'
        ? t.promotions.targetGroups
        : t.promotions.targetProducts
  const start = formatDate(p.startsAt)
  const end = formatDate(p.endsAt)

  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        {p.type === 'promocode' ? <Ticket className="size-6" /> : <Tag className="size-6" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-slate-900">{p.name}</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
            <Percent className="size-3" />
            {discount}
          </span>
          {p.promoCode && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
              {p.promoCode}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
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
      </div>

      <div className="hidden shrink-0 text-right md:block">
        <p className="text-xs text-slate-400">{t.promotions.totalDiscountLabel}</p>
        <p className="font-semibold text-slate-900">{formatMoney(Number(p.totalDiscountAmount))} ₴</p>
      </div>

      <label className="flex shrink-0 cursor-pointer items-center gap-2">
        <span className="sr-only">{t.promotions.statusSr}</span>
        <input
          type="checkbox"
          checked={!!p.isActive}
          disabled={busy}
          onChange={(e) => onToggle(p.id, e.target.checked)}
          className="peer sr-only"
        />
        <span className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-violet-600 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
      </label>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={t.promotions.actionsAria}
          >
            <MoreVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {p.promoCode && (
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(p.promoCode!)
                toast.success(t.promotions.toastCodeCopied)
              }}
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
  )
}
