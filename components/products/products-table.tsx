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
        toast.error(result.error ?? 'Произошла ошибка')
      }
    })
  }

  function handleDuplicate(id: number) {
    startTransition(async () => {
      const result = await duplicateProduct(id)
      if (result.success) {
        toast.success('Товар скопирован')
        router.refresh()
      } else {
        toast.error(result.error ?? 'Ошибка копирования')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-balance">Товары</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'товар' : total < 5 && total > 0 ? 'товара' : 'товаров'} в каталоге
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/api/admin/products/export" download>
              <Download className="size-4" />
              Экспорт CSV
            </a>
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus className="size-4" />
              Добавить товар
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
            placeholder="Поиск по названию или артикулу…"
            className="bg-card pl-8"
            aria-label="Поиск товаров"
          />
        </form>
        <Select
          value={filters.categoryId ? String(filters.categoryId) : 'all'}
          onValueChange={(v) => updateParams({ category: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-44 bg-card" aria-label="Фильтр по категории">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
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
          <SelectTrigger className="w-40 bg-card" aria-label="Фильтр по статусу">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="visible">Видимые</SelectItem>
            <SelectItem value="hidden">Скрытые</SelectItem>
            <SelectItem value="in_stock">В наличии</SelectItem>
            <SelectItem value="out_of_stock">Нет в наличии</SelectItem>
            <SelectItem value="popular">Популярные</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.sort ?? 'newest'}
          onValueChange={(v) => updateParams({ sort: v === 'newest' ? undefined : v })}
        >
          <SelectTrigger className="w-44 bg-card" aria-label="Сортировка">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Сначала новые</SelectItem>
            <SelectItem value="oldest">Сначала старые</SelectItem>
            <SelectItem value="price_asc">Цена: по возрастанию</SelectItem>
            <SelectItem value="price_desc">Цена: по убыванию</SelectItem>
            <SelectItem value="name">По названию</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-accent px-3 py-2">
          <span className="text-sm font-medium text-accent-foreground">
            Выбрано: {selected.size}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                runBulk(() => setProductsVisibility([...selected], true), 'Товары показаны')
              }
            >
              <Eye className="size-4" />
              Показать
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                runBulk(() => setProductsVisibility([...selected], false), 'Товары скрыты')
              }
            >
              <EyeOff className="size-4" />
              Скрыть
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => setDeleteTarget([...selected])}
            >
              <Trash2 className="size-4" />
              В корзину
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
                  aria-label="Выбрать все товары"
                />
              </TableHead>
              <TableHead>Товар</TableHead>
              <TableHead className="hidden md:table-cell">Артикул</TableHead>
              <TableHead className="hidden lg:table-cell">Категории</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Просмотры</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Остаток</TableHead>
              <TableHead className="hidden sm:table-cell">Статус</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="size-8" />
                    <p className="text-sm">Товары не найдены</p>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/admin/products/new">Добавить первый товар</Link>
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
                        aria-label={`Выбрать ${product.nameRu ?? product.nameUk}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-11 shrink-0 overflow-hidden rounded-md border bg-muted">
                          {product.image ? (
                            <Image
                              src={product.image || "/placeholder.svg"}
                              alt={product.nameRu ?? product.nameUk ?? 'Товар'}
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
                            {product.nameRu ?? product.nameUk ?? 'Без названия'}
                          </Link>
                          {product.isPopular && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Популярный
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
                            В наличии
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/15">
                            Нет в наличии
                          </Badge>
                        )}
                        {!product.isVisible && (
                          <Badge variant="secondary">Скрыт</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label="Действия с товаром">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/products/${product.id}/edit`}>
                              <Pencil className="size-4" />
                              Редактировать
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(product.id)}>
                            <Copy className="size-4" />
                            Дублировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              runBulk(
                                () => setProductsVisibility([product.id], !product.isVisible),
                                product.isVisible ? 'Товар скрыт' : 'Товар показан'
                              )
                            }
                          >
                            {product.isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            {product.isVisible ? 'Скрыть' : 'Показать'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget([product.id])}
                          >
                            <Trash2 className="size-4" />
                            В корзину
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
            Страница {page} из {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="size-4" />
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              Вперёд
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Переместить в корзину?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.length === 1
                ? 'Товар будет перемещён в корзину. Его можно будет восстановить.'
                : `${deleteTarget?.length ?? 0} товаров будут перемещены в корзину. Их можно будет восстановить.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  runBulk(() => softDeleteProducts(deleteTarget), 'Перемещено в корзину')
                }
                setDeleteTarget(null)
              }}
            >
              В корзину
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
