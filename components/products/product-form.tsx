'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createProduct, updateProduct, type ProductInput, type VariantInput } from '@/app/actions/products'
import type { Category, ProductGroup, SiteGroup, MarketplaceCategory, ProductOption } from '@/lib/db/schema'
import { ProductVariantsEditor } from '@/components/products/product-variants-editor'
import { CategoryCascader } from '@/components/products/category-cascader'
import { ImageUploader, ImageGalleryUploader } from '@/components/products/image-uploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type Characteristic = { name: string; value: string }

export type ProductFormData = {
  id?: number
  nameUk: string
  nameRu: string
  descriptionUk: string
  descriptionRu: string
  privateNotes: string
  salesType: string
  sku: string
  barcode: string
  price: string
  priceFrom: boolean
  currency: string
  oldPrice: string
  costPrice: string
  quantity: string
  unit: string
  siteGroupId: string
  marketplaceCategoryId: string
  width: string
  height: string
  length: string
  weight: string
  isVisible: boolean
  isPopular: boolean
  purchasesBoost: string
  realOrdersCount: number
  metaTitleUk: string
  metaTitleRu: string
  metaDescriptionUk: string
  metaDescriptionRu: string
  image: string | null
  images: string[]
  categoryIds: number[]
  groupIds: number[]
  characteristics: Characteristic[]
  options: ProductOption[]
  variants: VariantInput[]
}

export const emptyProduct: ProductFormData = {
  nameUk: '',
  nameRu: '',
  descriptionUk: '',
  descriptionRu: '',
  privateNotes: '',
  salesType: 'retail',
  sku: '',
  barcode: '',
  price: '',
  priceFrom: false,
  currency: 'UAH',
  oldPrice: '',
  costPrice: '',
  quantity: '0',
  unit: 'шт',
  siteGroupId: '',
  marketplaceCategoryId: '',
  width: '',
  height: '',
  length: '',
  weight: '',
  isVisible: true,
  isPopular: false,
  purchasesBoost: '0',
  realOrdersCount: 0,
  metaTitleUk: '',
  metaTitleRu: '',
  metaDescriptionUk: '',
  metaDescriptionRu: '',
  image: null,
  images: [],
  categoryIds: [],
  groupIds: [],
  characteristics: [],
  options: [],
  variants: [],
}

export function ProductForm({
  initial,
  categories,
  groups,
  siteGroups,
  marketplaceCategories,
}: {
  initial: ProductFormData
  categories: Category[]
  groups: ProductGroup[]
  siteGroups: SiteGroup[]
  marketplaceCategories: MarketplaceCategory[]
}) {
  const router = useRouter()
  const { dict } = useAdminI18n()
  const t = dict.productForm
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<ProductFormData>(initial)
  const isEdit = initial.id != null

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleGroup(id: number) {
    set(
      'groupIds',
      form.groupIds.includes(id) ? form.groupIds.filter((g) => g !== id) : [...form.groupIds, id]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.nameRu.trim() && !form.nameUk.trim()) {
      toast.error(t.toastNameRequired)
      return
    }
    if (form.price === '' || Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      toast.error(t.toastPriceInvalid)
      return
    }

    const input: ProductInput = {
      nameUk: form.nameUk,
      nameRu: form.nameRu,
      descriptionUk: form.descriptionUk,
      descriptionRu: form.descriptionRu,
      privateNotes: form.privateNotes,
      salesType: form.salesType,
      sku: form.sku,
      barcode: form.barcode,
      price: form.price,
      priceFrom: form.priceFrom,
      currency: form.currency,
      oldPrice: form.oldPrice || null,
      costPrice: form.costPrice || null,
      quantity: Math.max(0, Math.trunc(Number(form.quantity) || 0)),
      unit: form.unit,
      siteGroupId: form.siteGroupId ? Number(form.siteGroupId) : null,
      marketplaceCategoryId: form.marketplaceCategoryId ? Number(form.marketplaceCategoryId) : null,
      width: form.width || null,
      height: form.height || null,
      length: form.length || null,
      weight: form.weight || null,
      image: form.image,
      images: form.images,
      isVisible: form.isVisible,
      isPopular: form.isPopular,
      purchasesBoost: Math.max(0, Math.trunc(Number(form.purchasesBoost) || 0)),
      metaTitleUk: form.metaTitleUk,
      metaTitleRu: form.metaTitleRu,
      metaDescriptionUk: form.metaDescriptionUk,
      metaDescriptionRu: form.metaDescriptionRu,
      categoryIds: form.categoryIds,
      groupIds: form.groupIds,
      characteristics: form.characteristics,
      options: form.options,
      variants: form.variants,
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateProduct(initial.id as number, input)
        : await createProduct(input)
      if (result.success) {
        toast.success(isEdit ? t.toastUpdated : t.toastCreated)
        router.push('/admin/products')
        router.refresh()
      } else {
        toast.error(result.error ?? t.toastSaveError)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link href="/admin/products" aria-label={t.backToListAria}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-balance">
              {isEdit ? t.editTitle : t.createTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit ? `${t.idPrefix}: ${initial.id}` : t.fillInfoHint}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" type="button">
            <Link href="/admin/products">{t.cancel}</Link>
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? t.save : t.createProduct}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="main" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="main">{t.tabMain}</TabsTrigger>
          <TabsTrigger value="price">{t.tabPrice}</TabsTrigger>
          <TabsTrigger value="variants">{t.tabVariants}</TabsTrigger>
          <TabsTrigger value="categories">{t.tabCategories}</TabsTrigger>
          <TabsTrigger value="chars">{t.tabChars}</TabsTrigger>
          <TabsTrigger value="seo">{t.tabSeo}</TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.photosTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label>{t.mainPhotoLabel}</Label>
                <p className="text-xs text-muted-foreground">{t.mainPhotoHint}</p>
                <ImageUploader value={form.image} onChange={(url) => set('image', url)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.galleryLabel}</Label>
                <p className="text-xs text-muted-foreground">{t.galleryHint}</p>
                <ImageGalleryUploader value={form.images} onChange={(urls) => set('images', urls)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.nameSectionTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nameRu">{t.nameRuLabel}</Label>
                <Input
                  id="nameRu"
                  value={form.nameRu}
                  onChange={(e) => set('nameRu', e.target.value)}
                  placeholder={t.nameRuPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nameUk">{t.nameUkLabel}</Label>
                <Input
                  id="nameUk"
                  value={form.nameUk}
                  onChange={(e) => set('nameUk', e.target.value)}
                  placeholder={t.nameUkPlaceholder}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="descRu">{t.descRuLabel}</Label>
                <Textarea
                  id="descRu"
                  rows={4}
                  value={form.descriptionRu}
                  onChange={(e) => set('descriptionRu', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="descUk">{t.descUkLabel}</Label>
                <Textarea
                  id="descUk"
                  rows={4}
                  value={form.descriptionUk}
                  onChange={(e) => set('descriptionUk', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label htmlFor="notes">{t.notesLabel}</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={form.privateNotes}
                  onChange={(e) => set('privateNotes', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.identificationTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sku">{t.skuLabel}</Label>
                <Input id="sku" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="barcode">{t.barcodeLabel}</Label>
                <Input
                  id="barcode"
                  value={form.barcode}
                  onChange={(e) => set('barcode', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.salesTypeLabel}</Label>
                <Select value={form.salesType} onValueChange={(v) => set('salesType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">{t.salesTypeRetail}</SelectItem>
                    <SelectItem value="wholesale">{t.salesTypeWholesale}</SelectItem>
                    <SelectItem value="both">{t.salesTypeBoth}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-1">
                <div>
                  <Label htmlFor="visible">{t.visibleLabel}</Label>
                  <p className="text-xs text-muted-foreground">{t.visibleHint}</p>
                </div>
                <Switch
                  id="visible"
                  checked={form.isVisible}
                  onCheckedChange={(v) => set('isVisible', v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-1">
                <div>
                  <Label htmlFor="popular">{t.popularLabel}</Label>
                  <p className="text-xs text-muted-foreground">{t.popularHint}</p>
                </div>
                <Switch
                  id="popular"
                  checked={form.isPopular}
                  onCheckedChange={(v) => set('isPopular', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.purchaseCounterTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label>{t.realOrdersLabel}</Label>
                <Input value={String(form.realOrdersCount)} disabled readOnly />
                <p className="text-xs text-muted-foreground">{t.realOrdersHint}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="purchasesBoost">{t.purchasesBoostLabel}</Label>
                <Input
                  id="purchasesBoost"
                  type="number"
                  min="0"
                  step="1"
                  value={form.purchasesBoost}
                  onChange={(e) => set('purchasesBoost', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.purchasesBoostHint}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.shownToBuyersLabel}</Label>
                <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm font-semibold">
                  {form.realOrdersCount + Math.max(0, Math.trunc(Number(form.purchasesBoost) || 0))}
                </div>
                <p className="text-xs text-muted-foreground">{t.shownToBuyersHint}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.dimensionsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="width">{t.widthLabel}</Label>
                <Input
                  id="width"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.width}
                  onChange={(e) => set('width', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="height">{t.heightLabel}</Label>
                <Input
                  id="height"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.height}
                  onChange={(e) => set('height', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="length">{t.lengthLabel}</Label>
                <Input
                  id="length"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.length}
                  onChange={(e) => set('length', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="weight">{t.weightLabel}</Label>
                <Input
                  id="weight"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.weight}
                  onChange={(e) => set('weight', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="price" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.pricesTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">{t.priceLabel}</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="oldPrice">{t.oldPriceLabel}</Label>
                <Input
                  id="oldPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.oldPrice}
                  onChange={(e) => set('oldPrice', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="costPrice">{t.costPriceLabel}</Label>
                <Input
                  id="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => set('costPrice', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.currencyLabel}</Label>
                <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UAH">UAH (₴)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div>
                  <Label htmlFor="priceFrom">{t.priceFromLabel}</Label>
                  <p className="text-xs text-muted-foreground">{t.priceFromHint}</p>
                </div>
                <Switch
                  id="priceFrom"
                  checked={form.priceFrom}
                  onCheckedChange={(v) => set('priceFrom', v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.stockTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="quantity">{t.quantityLabel}</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={(e) => set('quantity', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.quantityHint}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="unit">{t.unitLabel}</Label>
                <Input id="unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.productCategoriesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.noCategoriesHint}{' '}
                  <Link href="/admin/categories" className="text-primary underline">
                    {t.createCategoryLink}
                  </Link>
                </p>
              ) : (
                <CategoryCascader
                  categories={categories}
                  value={form.categoryIds}
                  onChange={(ids) => set('categoryIds', ids)}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.productGroupsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t.noGroupsHint}{' '}
                  <Link href="/admin/groups" className="text-primary underline">
                    {t.createGroupLink}
                  </Link>
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={form.groupIds.includes(g.id)}
                        onCheckedChange={() => toggleGroup(g.id)}
                      />
                      {g.nameRu}
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.placementTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>{t.siteGroupLabel}</Label>
                <Select
                  value={form.siteGroupId || 'none'}
                  onValueChange={(v) => set('siteGroupId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.notSelected} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.notSelected}</SelectItem>
                    {siteGroups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.nameRu}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{t.marketplaceCategoryLabel}</Label>
                <Select
                  value={form.marketplaceCategoryId || 'none'}
                  onValueChange={(v) => set('marketplaceCategoryId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.notSelected} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.notSelected}</SelectItem>
                    {marketplaceCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.parentId ? '— ' : ''}
                        {c.nameRu}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chars" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.charsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {form.characteristics.length === 0 && (
                <p className="text-sm text-muted-foreground">{t.charsEmptyHint}</p>
              )}
              {form.characteristics.map((char, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={char.name}
                    onChange={(e) => {
                      const next = [...form.characteristics]
                      next[i] = { ...next[i], name: e.target.value }
                      set('characteristics', next)
                    }}
                    placeholder={t.charNamePlaceholder}
                    aria-label={`${t.charNameAria} ${i + 1}`}
                  />
                  <Input
                    value={char.value}
                    onChange={(e) => {
                      const next = [...form.characteristics]
                      next[i] = { ...next[i], value: e.target.value }
                      set('characteristics', next)
                    }}
                    placeholder={t.charValuePlaceholder}
                    aria-label={`${t.charValueAria} ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    aria-label={t.removeCharAria}
                    onClick={() =>
                      set(
                        'characteristics',
                        form.characteristics.filter((_, j) => j !== i)
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() =>
                  set('characteristics', [...form.characteristics, { name: '', value: '' }])
                }
              >
                <Plus className="size-4" />
                {t.addChar}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variants" className="mt-4">
          <ProductVariantsEditor
            options={form.options}
            variants={form.variants}
            currency={form.currency}
            onChange={(options, variants) => setForm((f) => ({ ...f, options, variants }))}
          />
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.seoTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="metaTitleRu">{t.metaTitleRuLabel}</Label>
                <Input
                  id="metaTitleRu"
                  value={form.metaTitleRu}
                  onChange={(e) => set('metaTitleRu', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="metaTitleUk">{t.metaTitleUkLabel}</Label>
                <Input
                  id="metaTitleUk"
                  value={form.metaTitleUk}
                  onChange={(e) => set('metaTitleUk', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="metaDescRu">{t.metaDescRuLabel}</Label>
                <Textarea
                  id="metaDescRu"
                  rows={3}
                  value={form.metaDescriptionRu}
                  onChange={(e) => set('metaDescriptionRu', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="metaDescUk">{t.metaDescUkLabel}</Label>
                <Textarea
                  id="metaDescUk"
                  rows={3}
                  value={form.metaDescriptionUk}
                  onChange={(e) => set('metaDescriptionUk', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button asChild variant="outline" type="button">
          <Link href="/admin/products">{t.cancel}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isEdit ? t.saveChanges : t.createProduct}
        </Button>
      </div>
    </form>
  )
}
