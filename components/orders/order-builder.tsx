'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Minus,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createOrder, searchProductsForOrder } from '@/app/actions/orders'
import Link from 'next/link'
import { useAdminI18n } from '@/lib/i18n/admin/context'

type CartItem = {
  productId?: number
  name: string
  sku?: string
  image?: string | null
  price: number
  quantity: number
  stock?: number
}

type ProductResult = {
  id: number
  name: string
  sku: string | null
  price: string
  image: string | null
  quantity: number
}

function money(n: number) {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(n) + ' ₴'
}

export function OrderBuilder() {
  const router = useRouter()
  const { dict } = useAdminI18n()
  const t = dict.orders
  const [isPending, startTransition] = useTransition()

  const [items, setItems] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('')
  const [deliveryBranch, setDeliveryBranch] = useState('')
  const [deliveryCost, setDeliveryCost] = useState('0')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductResult[]>([])
  const [searching, setSearching] = useState(false)

  const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const itemsCount = items.reduce((s, i) => s + i.quantity, 0)
  const total = itemsTotal + (Number.parseFloat(deliveryCost) || 0)

  async function runSearch(q: string) {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const res = await searchProductsForOrder(q)
    setResults(res as ProductResult[])
    setSearching(false)
  }

  function addProduct(p: ProductResult) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id)
      if (existing) {
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku ?? undefined,
          image: p.image,
          price: Number.parseFloat(p.price),
          quantity: 1,
          stock: p.quantity,
        },
      ]
    })
    toast.success(t.toastProductAdded)
  }

  function updateQty(index: number, delta: number) {
    setItems((prev) =>
      prev
        .map((i, idx) => (idx === index ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i))
        .filter((i) => i.quantity > 0),
    )
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  function addTag() {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  function handleSave() {
    if (items.length === 0) {
      toast.error(t.toastAddAtLeastOneItem)
      return
    }
    startTransition(async () => {
      const res = await createOrder({
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        paymentMethod: paymentMethod || undefined,
        deliveryMethod: deliveryMethod || undefined,
        deliveryCity: deliveryCity || undefined,
        deliveryBranch: deliveryBranch || undefined,
        deliveryCost: Number.parseFloat(deliveryCost) || 0,
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          sku: i.sku,
          image: i.image ?? undefined,
          price: i.price,
          quantity: i.quantity,
        })),
        note: note || undefined,
        tags,
      })
      if (res.success) {
        toast.success(t.toastOrderCreated.replace('{n}', String(res.orderNumber)))
        router.push(`/admin/orders/${res.id}`)
      } else {
        toast.error(t.toastCreateFailed)
      }
    })
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/admin/orders" aria-label={t.backToOrdersAria}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-foreground">{t.newOrder}</h1>
        </div>
        <Button onClick={handleSave} disabled={isPending || items.length === 0}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {t.saveOrder}
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-6 p-4 md:p-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* Items */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">{t.itemsInOrder} ({items.length})</h2>
              <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
                <Plus className="size-4" />
                {t.addItem}
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t.noItemsYet}
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image || '/placeholder.svg'} alt={item.name} className="size-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {money(item.price)}
                        {item.sku ? ` · ${item.sku}` : ''}
                        {item.stock !== undefined ? ` · ${t.stockLabel}: ${item.stock}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="size-7" onClick={() => updateQty(idx, -1)}>
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="size-7" onClick={() => updateQty(idx, 1)}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <p className="w-24 text-right text-sm font-medium text-foreground">
                      {money(item.price * item.quantity)}
                    </p>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeItem(idx)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Customer */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-semibold text-foreground">{t.customer}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-name">{t.name}</Label>
                <Input id="c-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t.namePlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-phone">{t.phone}</Label>
                <Input id="c-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={t.phonePlaceholder} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-email">{t.emailLabel}</Label>
                <Input id="c-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder={t.emailPlaceholder} />
              </div>
            </div>
          </section>

          {/* Payment & Delivery */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold text-foreground">{t.payment}</h2>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder={t.notSelectedOption} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">{dict.paymentMethods.online}</SelectItem>
                  <SelectItem value="cod">{dict.paymentMethods.cod}</SelectItem>
                  <SelectItem value="prepay">{dict.paymentMethods.prepay}</SelectItem>
                  <SelectItem value="cash">{dict.paymentMethods.cash}</SelectItem>
                </SelectContent>
              </Select>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-semibold text-foreground">{t.delivery}</h2>
              <div className="flex flex-col gap-3">
                <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.notSelectedOption} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nova_poshta">{dict.deliveryMethods.nova_poshta}</SelectItem>
                    <SelectItem value="ukrposhta">{dict.deliveryMethods.ukrposhta}</SelectItem>
                    <SelectItem value="courier">{dict.deliveryMethods.courier}</SelectItem>
                    <SelectItem value="pickup">{dict.deliveryMethods.pickup}</SelectItem>
                  </SelectContent>
                </Select>
                {deliveryMethod && (
                  <>
                    <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} placeholder={t.city} />
                    <Input value={deliveryBranch} onChange={(e) => setDeliveryBranch(e.target.value)} placeholder={t.branch} />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="d-cost" className="text-sm text-muted-foreground">{t.cost}</Label>
                      <Input id="d-cost" type="number" value={deliveryCost} onChange={(e) => setDeliveryCost(e.target.value)} className="w-28" />
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t.total}</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.itemsInOrder} ({itemsCount})</span>
                <span className="text-foreground">{money(itemsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.delivery}</span>
                <span className="text-foreground">{money(Number.parseFloat(deliveryCost) || 0)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span className="text-foreground">{t.toPay}</span>
                <span className="text-primary">{money(total)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t.tags}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t.tagsHint}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                  {tag}
                  <button onClick={() => setTags(tags.filter((x) => x !== tag))} aria-label={`${t.removeTagAria} ${tag}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder={t.newTagPlaceholder}
                className="h-8"
              />
              <Button variant="outline" size="sm" onClick={addTag}>
                <Plus className="size-4" />
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">{t.notes}</h2>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 300))}
              placeholder={t.notePlaceholder}
              className="mt-3 min-h-24"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{note.length}/300</p>
          </section>
        </div>
      </div>

      {/* Product search dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.addItem}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              placeholder={t.searchDialogPlaceholder}
              className="pl-9"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {searching && <p className="p-4 text-center text-sm text-muted-foreground">{t.searching}</p>}
            {!searching && query.length >= 2 && results.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">{t.nothingFound}</p>
            )}
            <div className="flex flex-col divide-y divide-border">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="flex items-center gap-3 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image || '/placeholder.svg'} alt={p.name} className="size-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {money(Number.parseFloat(p.price))} · {t.stockLabel}: {p.quantity}
                    </p>
                  </div>
                  <Plus className="size-4 text-primary" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
