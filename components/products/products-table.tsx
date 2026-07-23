'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  softDeleteProducts,
  setProductsVisibility,
  duplicateProduct,
  type ProductFilters,
} from '@/app/actions/products'
import type { Product, Category } from '@/lib/db/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  Download,
  MoreHorizontal,
  Pencil,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Package,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { pluralize } from '@/lib/i18n/plural'

const PER_PAGE = 10

function formatPrice(value: string | null, currency = 'UAH') {
  if (value == null) return '—'
  const symbol = currency === 'UAH' ? '₴' : currency
  return `${Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${symbol}`
}

export function ProductsTable({
  products,
  total,
  categories,
  categoriesByProduct,
  filters,
}: {
  products: Product[]
  total: number
  categories: (Category & { productCount: number })[]
  categoriesByProduct: Record<number, number[]>
  filters: ProductFilters
}) {
  const router = useRouter()
  const { dict } = useAdminI18n()
  const t = dict.products
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [searchValue, setSearchValue] = useState(filters.search ?? '')
  const [deleteTarget, setDeleteTarget] = useState<number[] | null>(null)

  const page = filters.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const categoryNames = new Map(categories.map((c) => [c.id, c.nameRu]))

  function updateParams(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams()
    const next = {
      search: filters.search,
      category: filters.categoryId ? String(filters.categoryId) : undefined,
      status: filters.status !== 'all' ? filters.status : undefined,
      sort: filters.sort !== 'newest' ? filters.sort : undefined,
      page: undefined as string | undefined,
      ...patch,
    }
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value)
    }
    setSelected(new Set())
    router.push(`/admin/products?${params.toString()}`)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    updateParams({ search: searchValue.trim() || undefined })
  }

  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)))
  }

  function toggleOne(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function runBulk(fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.success) {
        toast.success(successMsg)
        setSelected(new Set())
        router.refresh()
      } else {
        toast.error(result.error ?? t.toastGenericError)
      }
    })
  }

  function handleDuplicate(id: number) {
    startTransition(async () => {
      const result = await duplicateProduct(id)
      if (result.success) {
        toast.success(t.toastCopied)
        router.refresh()
      } else {
        toast.error(result.error ?? t.toastCopyError)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-balance">{t.title}</h1>
          <p className="text-sm text-muted-foreground">
            {total} {pluralize(total, t.countOne, t.countFew, t.countMany)} {t.inCatalog}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/admin/products/export" download>
              <Download className="size-4" />
              {t.exportCsv}
            </a>
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" />
              {t.addProduct}
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative min-w-52 flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="bg-card pl-8"
            aria-label={t.searchPlaceholder}
          />
        </form>
        <Select
          value={filters.categoryId ? String(filters.categoryId) : 'all'}
          onValueChange={(v) => updateParams({ category: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-44 bg-card" aria-label={t.categoryPlaceholder}>
            <SelectValue placeholder={t.categoryPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allCategories}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.nameRu} ({c.productCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status ?? 'all'}
          onValueChange={(v) => updateParams({ status: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-40 bg-card" aria-label={t.statusPlaceholder}>
            <SelectValue placeholder={t.statusPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allStatuses}</SelectItem>
            <SelectItem value="visible">{t.visible}</SelectItem>
            <SelectItem value="hidden">{t.hidden}</SelectItem>
            <SelectItem value="in_stock">{t.inStock}</SelectItem>
            <SelectItem value="out_of_stock">{t.outOfStock}</SelectItem>
            <SelectItem value="popular">{t.popular}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.sort ?? 'newest'}
          onValueChange={(v) => updateParams({ sort: v === 'newest' ? undefined : v })}
        >
          <SelectTrigger className="w-44 bg-card" aria-label={t.sortPlaceholder}>
            <SelectValue placeholder={t.sortPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t.sortNewest}</SelectItem>
            <SelectItem value="oldest">{t.sortOldest}</SelectItem>
            <SelectItem value="price_asc">{t.priceAsc}</SelectItem>
            <SelectItem value="price_desc">{t.priceDesc}</SelectItem>
            <SelectItem value="name">{t.byName}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent px-3 py-2">
          <span className="text-sm font-medium text-accent-foreground">
            {t.selectedCount}: {selected.size}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                runBulk(() => setProductsVisibility([...selected], true), t.toastShown)
              }
            >
              <Eye className="size-4" />
              {t.show}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                runBulk(() => setProductsVisibility([...selected], false), t.toastHidden)
              }
            >
              <EyeOff className="size-4" />
              {t.hide}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => setDeleteTarget([...selected])}
            >
              <Trash2 className="size-4" />
              {t.toTrash}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label={t.selectedCount}
                />
              </TableHead>
              <TableHead>{t.colProduct}</TableHead>
              <TableHead className="hidden md:table-cell">{t.colSku}</TableHead>
              <TableHead className="hidden lg:table-cell">{t.colCategories}</TableHead>
              <TableHead className="text-right">{t.colPrice}</TableHead>
              <TableHead className="hidden text-right lg:table-cell">{t.colViews}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{t.colStock}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.colStatus}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="size-8" />
                    <p className="text-sm">{t.notFound}</p>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/admin/products/new">{t.addFirst}</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const cats = (categoriesByProduct[product.id] ?? [])
                  .map((id) => categoryNames.get(id))
                  .filter(Boolean)
                return (
                  <TableRow key={product.id} data-state={selected.has(product.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(product.id)}
                        onCheckedChange={() => toggleOne(product.id)}
                        aria-label={product.nameRu ?? product.nameUk ?? ''}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                          {product.image ? (
                            <Image
                              src={product.image || "/placeholder.svg"}
                              alt={product.nameRu ?? product.nameUk ?? t.noName}
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground">
                              <ImageIcon className="size-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {product.nameRu ?? product.nameUk ?? t.noName}
                          </Link>
                          {product.isPopular && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {t.popularBadge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {product.sku ?? '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {cats.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          cats.map((name) => (
                            <Badge key={name} variant="outline" className="text-xs font-normal">
                              {name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium tabular-nums">
                        {formatPrice(product.price, product.currency ?? 'UAH')}
                      </span>
                      {product.oldPrice && (
                        <span className="ml-1.5 text-xs text-muted-foreground line-through tabular-nums">
                          {formatPrice(product.oldPrice, product.currency ?? 'UAH')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">
                      <span className="text-muted-foreground">{product.viewsCount ?? 0}</span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      <span className={product.quantity === 0 ? 'text-destructive' : ''}>
                        {product.quantity} {product.unit}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {product.quantity > 0 ? (
                          <Badge className="bg-success/15 text-success hover:bg-success/15">
                            {t.inStock}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/15">
                            {t.outOfStock}
                          </Badge>
                        )}
                        {!product.isVisible && (
                          <Badge variant="secondary">{t.hidden}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={t.colActions}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/products/${product.id}/edit`}>
                              <Pencil className="size-4" />
                              {t.edit}
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(product.id)}>
                            <Copy className="size-4" />
                            {t.duplicate}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              runBulk(
                                () => setProductsVisibility([product.id], !product.isVisible),
                                product.isVisible ? t.toastProductHidden : t.toastProductShown
                              )
                            }
                          >
                            {product.isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            {product.isVisible ? t.hide : t.show}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget([product.id])}
                          >
                            <Trash2 className="size-4" />
                            {t.toTrash}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t.pageLabel} {page} {t.pageOf} {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="size-4" />
              {t.back}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              {t.next}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.moveToTrashTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.length === 1
                ? t.moveToTrashDescSingle
                : `${deleteTarget?.length ?? 0} ${t.moveToTrashDescMany}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  runBulk(() => softDeleteProducts(deleteTarget), t.toastMovedToTrash)
                }
                setDeleteTarget(null)
              }}
            >
              {t.toTrash}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
