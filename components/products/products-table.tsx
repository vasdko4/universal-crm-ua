'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  softDeleteProducts,
  setProductsVisibility,
  duplicateProduct,
  bulkSetProductPrice,
  bulkAdjustProductStock,
  bulkSetProductCategory,
  bulkSetProductCharacteristics,
  updateProductPrice,
  updateProductStock,
  type ProductFilters,
} from '@/app/actions/products'
import { InlineEditCell, parsePriceInput, parseStockInput } from '@/components/products/inline-edit-cell'
import type { Product, Category } from '@/lib/db/schema'
import { isProxiedMedia } from '@/lib/shop/own-image-url'
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
import { pickLocalized } from '@/lib/i18n/config'
import { FilterPresetBar } from '@/components/admin/filter-preset-bar'
import { useColumnVisibility, ColumnToggle } from '@/components/admin/column-toggle'
import { BulkActionDrawer } from '@/components/admin/bulk-action-drawer'
import { useAdminHotkeys } from '@/components/admin/use-admin-hotkeys'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

const PER_PAGE = 10

/** Column ids that can be toggled in the products table (product + actions columns are always visible). */
const TOGGLEABLE_COLUMNS = ['sku', 'categories', 'price', 'views', 'stock', 'status']

type ProductPresetFilters = {
  search?: string
  category?: string
  status?: string
  sort?: string
}

type BulkAction = 'show' | 'hide' | 'price' | 'stock' | 'category' | 'chars' | 'trash'

function formatPrice(value: string | null, currency = 'UAH', locale: string = 'uk') {
  if (value == null) return '—'
  const symbol = currency === 'UAH' ? '₴' : currency
  const numberLocale = locale === 'ru' ? 'ru-RU' : 'uk-UA'
  return `${Number(value).toLocaleString(numberLocale, { minimumFractionDigits: 2 })} ${symbol}`
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
  const { dict, locale } = useAdminI18n()
  const t = dict.products
  const c = dict.common
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [searchValue, setSearchValue] = useState(filters.search ?? '')
  const searchRef = useRef<HTMLInputElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<number[] | null>(null)
  const [bulkPrice, setBulkPrice] = useState('')
  const [bulkDelta, setBulkDelta] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkBrand, setBulkBrand] = useState('')
  const [bulkChars, setBulkChars] = useState<{ name: string; value: string }[]>([{ name: '', value: '' }])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<BulkAction>('price')
  // Optimistic overrides for inline price/stock edits (server data arrives via router.refresh()).
  const [overrides, setOverrides] = useState<Record<number, { price?: string; quantity?: number }>>({})
  const { visible: visibleCols, toggle: toggleCol } = useColumnVisibility(
    'admin:cols:products',
    TOGGLEABLE_COLUMNS,
  )
  const showCol = (id: string) => visibleCols.includes(id)

  useAdminHotkeys({
    onFocusSearch: () => searchRef.current?.focus(),
    onNew: () => router.push('/admin/products/new'),
    onEscape: () => {
      setBulkOpen(false)
      setDeleteTarget(null)
    },
  })

  const page = filters.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const categoryNames = new Map(
    categories.map((cat) => [cat.id, pickLocalized(locale, cat.nameUk, cat.nameRu)]),
  )

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

  function runBulk(
    fn: () => Promise<{ success: boolean; error?: string; skipped?: number }>,
    successMsg: string,
  ) {
    startTransition(async () => {
      const result = await fn()
      if (result.success) {
        toast.success(successMsg)
        // BUGFIX: bulk price/stock skip variant-matrix products (their
        // price/qty are aggregates) — tell the admin instead of silently
        // ignoring them.
        if (result.skipped) {
          toast.info(t.toastBulkSkippedVariants.replace('{n}', String(result.skipped)))
        }
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

  function parseBulkNumber(raw: string): number | null {
    const n = Number(raw.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  function handleBulkConfirm() {
    const ids = [...selected]
    switch (bulkAction) {
      case 'show':
        runBulk(() => setProductsVisibility(ids, true), t.toastShown)
        break
      case 'hide':
        runBulk(() => setProductsVisibility(ids, false), t.toastHidden)
        break
      case 'price': {
        const n = parseBulkNumber(bulkPrice)
        if (n === null) {
          toast.error(t.invalidNumber)
          return
        }
        runBulk(() => bulkSetProductPrice(ids, n), t.toastPriceSet)
        break
      }
      case 'stock': {
        const n = parseBulkNumber(bulkDelta)
        if (n === null) {
          toast.error(t.invalidNumber)
          return
        }
        runBulk(() => bulkAdjustProductStock(ids, n), t.toastStockAdjusted)
        break
      }
      case 'category':
        if (!bulkCategory) return
        runBulk(() => bulkSetProductCategory(ids, Number(bulkCategory)), t.toastCategorySet)
        break
      case 'chars': {
        const pairs = bulkChars.filter((ch) => ch.name.trim() && ch.value.trim())
        if (!bulkBrand.trim() && pairs.length === 0) {
          toast.error(t.errCharsEmpty)
          return
        }
        runBulk(() => bulkSetProductCharacteristics(ids, bulkBrand, pairs), t.toastCharsSet)
        break
      }
      case 'trash':
        runBulk(() => softDeleteProducts(ids), t.toastMovedToTrash)
        break
    }
    setBulkOpen(false)
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

      <FilterPresetBar<ProductPresetFilters>
        storageKey="admin:presets:products"
        builtinPresets={[
          { id: 'visible', label: t.presetVisible, filters: { status: 'visible' } },
          { id: 'out_of_stock', label: t.presetOutOfStock, filters: { status: 'out_of_stock' } },
          { id: 'hidden', label: t.presetHidden, filters: { status: 'hidden' } },
          { id: 'popular', label: t.presetPopular, filters: { status: 'popular' } },
        ]}
        currentFilters={{
          search: filters.search,
          category: filters.categoryId ? String(filters.categoryId) : undefined,
          status: filters.status,
          sort: filters.sort,
        }}
        onApply={(f) => {
          setSearchValue(f.search ?? '')
          updateParams({ search: f.search, category: f.category, status: f.status, sort: f.sort })
        }}
        strings={{
          title: c.presetsTitle,
          saveLabel: c.presetSave,
          namePlaceholder: c.presetNamePlaceholder,
          deleteAria: c.presetDeleteAria,
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative min-w-52 flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
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
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={String(cat.id)}>
                {pickLocalized(locale, cat.nameUk, cat.nameRu)} ({cat.productCount})
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
        <ColumnToggle
          columns={[
            { id: 'sku', label: t.colSku },
            { id: 'categories', label: t.colCategories },
            { id: 'price', label: t.colPrice },
            { id: 'views', label: t.colViews },
            { id: 'stock', label: t.colStock },
            { id: 'status', label: t.colStatus },
          ]}
          visible={visibleCols}
          onToggle={toggleCol}
          label={c.columnsLabel}
        />
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
              onClick={() => setSelected(new Set())}
            >
              {t.clearSelection}
            </Button>
            <Button size="sm" disabled={isPending} onClick={() => setBulkOpen(true)}>
              {c.bulkActions}
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[70vh] overflow-x-hidden overflow-y-auto rounded-lg border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label={t.selectedCount}
                />
              </TableHead>
              <TableHead>{t.colProduct}</TableHead>
              {showCol('sku') && (
                <TableHead className="hidden md:table-cell">{t.colSku}</TableHead>
              )}
              {showCol('categories') && (
                <TableHead className="hidden lg:table-cell">{t.colCategories}</TableHead>
              )}
              {showCol('price') && <TableHead className="text-right">{t.colPrice}</TableHead>}
              {showCol('views') && (
                <TableHead className="hidden text-right lg:table-cell">{t.colViews}</TableHead>
              )}
              {showCol('stock') && (
                <TableHead className="hidden text-right sm:table-cell">{t.colStock}</TableHead>
              )}
              {showCol('status') && (
                <TableHead className="hidden sm:table-cell">{t.colStatus}</TableHead>
              )}
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
                        aria-label={pickLocalized(locale, product.nameUk, product.nameRu) || undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                          {product.image ? (
                            <Image
                              src={product.image || "/placeholder.svg"}
                              alt={pickLocalized(locale, product.nameUk, product.nameRu) || t.noName}
                              fill
                              sizes="44px"
                              unoptimized={isProxiedMedia(product.image)}
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
                            {pickLocalized(locale, product.nameUk, product.nameRu) || t.noName}
                          </Link>
                          {product.isPopular && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {t.popularBadge}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    {showCol('sku') && (
                      <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                        {product.sku ?? '—'}
                      </TableCell>
                    )}
                    {showCol('categories') && (
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
                    )}
                    {showCol('price') && (
                      <TableCell className="text-right">
                        <InlineEditCell
                          display={
                            <>
                              <span className="font-medium tabular-nums">
                                {formatPrice(
                                  overrides[product.id]?.price ?? product.price,
                                  product.currency ?? 'UAH',
                                  locale,
                                )}
                              </span>
                              {product.oldPrice && (
                                <span className="ml-1.5 text-xs text-muted-foreground line-through tabular-nums">
                                  {formatPrice(product.oldPrice, product.currency ?? 'UAH', locale)}
                                </span>
                              )}
                            </>
                          }
                          initial={overrides[product.id]?.price ?? product.price ?? ''}
                          label={`${t.colPrice}: ${pickLocalized(locale, product.nameUk, product.nameRu)}`}
                          hint={t.inlineEditHint}
                          successMessage={t.toastPriceSet}
                          errorMessage={t.toastGenericError}
                          onSaved={() => router.refresh()}
                          onSave={async (raw) => {
                            const parsed = parsePriceInput(raw)
                            const result = await updateProductPrice(product.id, parsed)
                            if (result.success) {
                              setOverrides((o) => ({
                                ...o,
                                [product.id]: { ...o[product.id], price: parsed.toFixed(2) },
                              }))
                            }
                            return result
                          }}
                        />
                      </TableCell>
                    )}
                    {showCol('views') && (
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">
                        <span className="text-muted-foreground">{product.viewsCount ?? 0}</span>
                      </TableCell>
                    )}
                    {showCol('stock') && (
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        <InlineEditCell
                          display={
                            <span className={(overrides[product.id]?.quantity ?? product.quantity) === 0 ? 'text-destructive' : ''}>
                              {overrides[product.id]?.quantity ?? product.quantity} {product.unit}
                            </span>
                          }
                          initial={String(overrides[product.id]?.quantity ?? product.quantity)}
                          label={`${t.colStock}: ${pickLocalized(locale, product.nameUk, product.nameRu)}`}
                          hint={t.inlineEditHint}
                          successMessage={t.toastStockAdjusted}
                          errorMessage={t.toastGenericError}
                          onSaved={() => router.refresh()}
                          onSave={async (raw) => {
                            const parsed = parseStockInput(raw)
                            const result = await updateProductStock(product.id, parsed)
                            if (result.success) {
                              setOverrides((o) => ({
                                ...o,
                                [product.id]: { ...o[product.id], quantity: parsed },
                              }))
                            }
                            return result
                          }}
                        />
                      </TableCell>
                    )}
                    {showCol('status') && (
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {product.quantity > 0 ? (
                            <Badge className="bg-success/15 text-success hover:bg-success/15">
                              {t.inStock}
                            </Badge>
                          ) : product.availabilityMode === 'preorder' ? (
                            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                              {t.preorderBadge}
                            </Badge>
                          ) : product.availabilityMode === 'coming_soon' ? (
                            <Badge className="bg-warning/15 text-warning hover:bg-warning/15">
                              {t.comingSoonBadge}
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
                    )}
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
      <BulkActionDrawer
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={c.bulkActions}
        description={t.bulkApplyTo.replace('{n}', String(selected.size))}
        confirmLabel={c.confirm}
        cancelLabel={c.cancel}
        destructive={bulkAction === 'trash'}
        isPending={isPending}
        confirmDisabled={
          (bulkAction === 'price' && !bulkPrice.trim()) ||
          (bulkAction === 'stock' && !bulkDelta.trim()) ||
          (bulkAction === 'category' && !bulkCategory) ||
          (bulkAction === 'chars' &&
            !bulkBrand.trim() &&
            !bulkChars.some((ch) => ch.name.trim() && ch.value.trim()))
        }
        onConfirm={handleBulkConfirm}
      >
        <p className="mb-3 text-sm font-medium text-foreground">{t.bulkChooseAction}</p>
        <RadioGroup
          value={bulkAction}
          onValueChange={(v) => setBulkAction(v as BulkAction)}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="show" id="bulk-show" />
            <Label htmlFor="bulk-show">{t.show}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="hide" id="bulk-hide" />
            <Label htmlFor="bulk-hide">{t.hide}</Label>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="price" id="bulk-price" />
              <Label htmlFor="bulk-price">{t.bulkActionPrice}</Label>
            </div>
            {bulkAction === 'price' && (
              <Input
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                placeholder={t.bulkPriceLabel}
                inputMode="decimal"
                className="ml-6 w-48"
                aria-label={t.bulkPriceLabel}
              />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="stock" id="bulk-stock" />
              <Label htmlFor="bulk-stock">{t.bulkActionStock}</Label>
            </div>
            {bulkAction === 'stock' && (
              <>
                <Input
                  value={bulkDelta}
                  onChange={(e) => setBulkDelta(e.target.value)}
                  placeholder={t.bulkStock}
                  inputMode="numeric"
                  className="ml-6 w-48"
                  aria-label={t.bulkStock}
                />
                <p className="ml-6 text-xs text-muted-foreground">{t.bulkStockHint}</p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="category" id="bulk-category" />
              <Label htmlFor="bulk-category">{t.bulkActionCategory}</Label>
            </div>
            {bulkAction === 'category' && (
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="ml-6 w-56" aria-label={t.bulkCategoryLabel}>
                  <SelectValue placeholder={t.bulkCategory} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {pickLocalized(locale, cat.nameUk, cat.nameRu)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="chars" id="bulk-chars" />
              <Label htmlFor="bulk-chars">{t.bulkActionChars}</Label>
            </div>
            {bulkAction === 'chars' && (
              <div className="ml-6 flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="bulk-brand">{t.bulkBrandLabel}</Label>
                  <Input
                    id="bulk-brand"
                    value={bulkBrand}
                    onChange={(e) => setBulkBrand(e.target.value)}
                    placeholder={t.bulkBrandPlaceholder}
                    className="w-56"
                  />
                </div>
                {bulkChars.map((ch, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={ch.name}
                      onChange={(e) => {
                        const next = [...bulkChars]
                        next[i] = { ...next[i], name: e.target.value }
                        setBulkChars(next)
                      }}
                      placeholder={t.bulkCharNamePlaceholder}
                      aria-label={`${t.bulkCharNamePlaceholder} ${i + 1}`}
                    />
                    <Input
                      value={ch.value}
                      onChange={(e) => {
                        const next = [...bulkChars]
                        next[i] = { ...next[i], value: e.target.value }
                        setBulkChars(next)
                      }}
                      placeholder={t.bulkCharValuePlaceholder}
                      aria-label={`${t.bulkCharValuePlaceholder} ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      aria-label={t.bulkRemoveCharAria}
                      onClick={() => setBulkChars(bulkChars.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                {bulkChars.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => setBulkChars([...bulkChars, { name: '', value: '' }])}
                  >
                    <Plus className="size-4" />
                    {t.bulkAddChar}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">{t.bulkCharsHint}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="trash" id="bulk-trash" />
              <Label htmlFor="bulk-trash">{t.bulkActionTrash}</Label>
            </div>
            {bulkAction === 'trash' && (
              <p className="ml-6 text-xs text-muted-foreground">{t.bulkTrashWarning}</p>
            )}
          </div>
        </RadioGroup>
      </BulkActionDrawer>
    </div>
  )
}
