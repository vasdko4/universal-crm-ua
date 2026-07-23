'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  deleteCustomer,
  addCustomerTag,
  removeCustomerTag,
  type CustomerListItem,
} from '@/app/actions/customers'
import { CustomerDialog } from './customer-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
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
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
  Users,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  X,
  MessageCircle,
} from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { pluralize } from '@/lib/i18n/plural'

type ListData = {
  items: CustomerListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function scoreColor(score: number) {
  if (score >= 80) return 'bg-success/15 text-success border-success/30'
  if (score >= 50) return 'bg-warning/15 text-warning border-warning/30'
  return 'bg-destructive/15 text-destructive border-destructive/30'
}

function formatMoney(v: string) {
  const n = Number(v)
  return new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Kyiv' })
}

export function CustomersManager({
  initialData,
  initialSearch,
  initialScore,
}: {
  initialData: ListData
  initialSearch: string
  initialScore: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { dict } = useAdminI18n()
  const t = dict.customers
  const CONTACT_LABELS: Record<string, string> = {
    viber: t.contactViber,
    skype: t.contactSkype,
    whatsapp: t.contactWhatsapp,
    telegram: t.contactTelegram,
    email: t.contactEmail,
    phone: t.contactPhone,
  }
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(initialSearch)
  const [score, setScore] = useState(initialScore)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerListItem | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(null)

  const [tagTarget, setTagTarget] = useState<CustomerListItem | null>(null)
  const [tagValue, setTagValue] = useState('')

  const data = initialData

  function applyFilters(next: { q?: string; score?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString())
    const q = next.q ?? search
    const s = next.score ?? score
    if (q) params.set('q', q)
    else params.delete('q')
    if (s && s !== '0') params.set('score', s)
    else params.delete('score')
    params.set('page', String(next.page ?? 1))
    startTransition(() => router.push(`/admin/customers?${params.toString()}`))
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    applyFilters({ page: 1 })
  }

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(c: CustomerListItem) {
    setEditing(c)
    setDialogOpen(true)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    startTransition(async () => {
      const res = await deleteCustomer(id)
      if (res.success) {
        toast.success(t.toastArchived)
        router.refresh()
      } else {
        toast.error(t.toastDeleteError)
      }
      setDeleteTarget(null)
    })
  }

  function submitTag() {
    if (!tagTarget) return
    const value = tagValue.trim()
    if (!value) return
    const id = tagTarget.id
    startTransition(async () => {
      const res = await addCustomerTag(id, value)
      if (res.success) {
        toast.success(`${t.toastTagAdded}: «${value}»`)
        router.refresh()
      } else {
        toast.error(res.error ?? t.toastError)
      }
      setTagValue('')
      setTagTarget(null)
    })
  }

  function handleRemoveTag(id: number, tag: string) {
    startTransition(async () => {
      const res = await removeCustomerTag(id, tag)
      if (res.success) router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {data.total} {pluralize(data.total, t.countOne, t.countFew, t.countMany)}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t.addCustomer}
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pl-9"
          />
        </form>
        <Select
          value={score}
          onValueChange={(v) => {
            setScore(v)
            applyFilters({ score: v, page: 1 })
          }}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder={t.reliabilityPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">{t.anyReliability}</SelectItem>
            <SelectItem value="80">{t.reliabilityHigh}</SelectItem>
            <SelectItem value="50">{t.reliabilityMedium}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => handleSearchSubmit(new Event('submit') as unknown as React.FormEvent)}>
          {t.find}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t.colCustomer}</TableHead>
              <TableHead>{t.colContacts}</TableHead>
              <TableHead className="text-center">{t.colReliability}</TableHead>
              <TableHead className="text-center">{t.colOrders}</TableHead>
              <TableHead className="text-right">{t.colTurnover}</TableHead>
              <TableHead>{t.colLastOrder}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="size-8 opacity-40" />
                    <p>{t.notFound}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-foreground">
                        {c.firstName} {c.lastName ?? ''}
                      </span>
                      {c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map((tg) => (
                            <Badge
                              key={tg}
                              variant="secondary"
                              className="gap-1 pr-1 text-xs font-normal"
                            >
                              {tg}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(c.id, tg)}
                                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                                aria-label={`${t.removeTagAria} ${tg}`}
                              >
                                <X className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <Phone className="size-3.5 text-muted-foreground" />
                        {c.phone}
                      </span>
                      {c.email && (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="size-3.5" />
                          {c.email}
                        </span>
                      )}
                      {c.contacts.length > 0 && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageCircle className="size-3.5" />
                          {c.contacts
                            .map((ct) => `${CONTACT_LABELS[ct.type] ?? ct.type}: ${ct.value}`)
                            .join(', ')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={scoreColor(c.reliabilityScore)}>
                      {c.reliabilityScore}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{c.ordersCount}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(c.totalTurnover)} ₴
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.lastOrderDate)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label={t.actionsAria}>
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil className="size-4" />
                          {t.edit}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setTagTarget(c)
                            setTagValue('')
                          }}
                        >
                          <Tag className="size-4" />
                          {t.addTag}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="size-4" />
                          {t.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t.pageLabel} {data.page} {t.pageOf} {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || isPending}
              onClick={() => applyFilters({ page: data.page - 1 })}
            >
              <ChevronLeft className="size-4" />
              {t.back}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || isPending}
              onClick={() => applyFilters({ page: data.page + 1 })}
            >
              {t.next}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editing}
        onSaved={() => router.refresh()}
      />

      {/* Диалог добавления тега */}
      <Dialog open={!!tagTarget} onOpenChange={(o) => !o && setTagTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t.addTagTitle}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitTag()
            }}
            className="flex flex-col gap-4"
          >
            <Input
              autoFocus
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder={t.tagPlaceholder}
            />
            <div className="flex flex-wrap gap-1.5">
              {['VIP', 'Опт', 'Роздріб', 'Постійний', 'Проблемний'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTagValue(preset)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  {preset}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTagTarget(null)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isPending || !tagValue.trim()}>
                {t.add}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.firstName} {deleteTarget?.lastName ?? ''} {t.deleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
