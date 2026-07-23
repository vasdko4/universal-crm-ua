'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  User,
  Truck,
  CreditCard,
  Loader2,
  Check,
  Search,
  ShoppingBag,
  Banknote,
  FileText,
  ChevronRight,
  Minus,
  Plus,
  X,
  MapPin,
  Tag,
  Trash2,
  Lock,
  ShieldCheck,
  RotateCcw,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCart, formatPrice } from '@/lib/shop/cart-context'
import { searchCities, searchWarehouses } from '@/app/actions/nova-poshta'
import { createStorefrontOrder, type CheckoutResult } from '@/app/actions/shop'
import { saveAbandonedCart } from '@/app/actions/abandoned-carts'
import { validatePromoCode } from '@/app/actions/promotions'
import { saveUserAddress, deleteUserAddress, type UserAddress } from '@/app/actions/addresses'
import { toast } from 'sonner'
import { useSession } from '@/lib/auth-client'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { trackBeginCheckout } from '@/components/shop/google-ads'

// No `config` here on purpose — that column holds admin secrets (Nova Poshta
// apiKey, bank IBAN/EDRPOU). See app/(shop)/checkout/page.tsx for why it must
// never cross the Server->Client Component boundary on this page.
type Method = { code: string; name: string }

type NpCity = { ref: string; name: string; area: string; deliveryCityRef: string }
type NpWarehouse = { ref: string; name: string; number: string }

export function CheckoutFlow({
  deliveryMethods,
  paymentMethods,
  buyNow = false,
  savedAddresses = [],
  gaId,
  minOrder,
}: {
  deliveryMethods: Method[]
  paymentMethods: Method[]
  buyNow?: boolean
  savedAddresses?: UserAddress[]
  gaId?: string
  minOrder?: { enabled: boolean; amount: number }
}) {
  const router = useRouter()
  const { dict } = useI18n()
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const t = dict.checkout

  // Localize well-known delivery/payment methods by code; fall back to the DB name for custom ones.
  const methodLabel = (code: string, fallback: string) => {
    const map: Record<string, string> = {
      nova_poshta: t.mNovaPoshta,
      ukrposhta: t.mUkrposhta,
      cod: t.mCod,
      online: t.mOnline,
      requisites: t.mRequisites,
    }
    return map[code] ?? fallback
  }

  const {
    items: cartItems,
    setQuantity,
    remove,
    clear,
    buyNowItem,
    setBuyNowQuantity,
    clearBuyNow,
  } = useCart()

  // In express "Купить сейчас" mode we check out ONLY the buy-now item and never
  // touch the cart. Otherwise we check out the whole cart.
  const items = useMemo(
    () => (buyNow ? (buyNowItem ? [buyNowItem] : []) : cartItems),
    [buyNow, buyNowItem, cartItems],
  )
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items])
  const totalItems = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items])

  // GA4 begin_checkout: fired once per checkout-page visit with a non-empty
  // cart/buy-now item, so the funnel between "add to cart" and "purchase" is
  // no longer a blind spot in reporting.
  const beginCheckoutFired = useRef(false)
  useEffect(() => {
    if (beginCheckoutFired.current || items.length === 0) return
    beginCheckoutFired.current = true
    trackBeginCheckout(
      gaId,
      items.map((i) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
    )
  }, [gaId, items])

  // Store-wide minimum order amount (Настройки → Общие). This is a UX
  // convenience only — the server re-checks it authoritatively in
  // createStorefrontOrder, so it can't be bypassed by editing client state.
  const minOrderShortfall =
    minOrder?.enabled && minOrder.amount > 0 ? Math.max(0, minOrder.amount - subtotal) : 0
  const belowMinOrder = minOrderShortfall > 0

  // Route quantity edits / removal to the right store depending on the mode.
  const updateQty = (key: string, quantity: number) => {
    if (buyNow) setBuyNowQuantity(quantity)
    else setQuantity(key, quantity)
  }
  const removeItem = (key: string) => {
    if (buyNow) clearBuyNow()
    else remove(key)
  }

  // Per-field validation errors displayed inline below inputs.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({})
  const clearFieldError = (field: string) =>
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev))

  // Promo code state. `applied` holds the validated preview from the server.
  const [promoInput, setPromoInput] = useState('')
  const [promoChecking, setPromoChecking] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [applied, setApplied] = useState<{ code: string; name: string; discount: number } | null>(null)

  // Discount is capped at the subtotal; total never goes below zero.
  const discount = applied ? Math.min(applied.discount, subtotal) : 0
  const total = Math.max(0, subtotal - discount)

  const promoLines = useMemo(
    () => items.map((i) => ({ productId: i.id, price: i.price, quantity: i.quantity })),
    [items],
  )

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code) return
    setPromoChecking(true)
    setPromoError(null)
    try {
      const res = await validatePromoCode(code, promoLines)
      if (!res.ok) {
        setApplied(null)
        setPromoError(res.error)
        return
      }
      setApplied({ code: res.code, name: res.name, discount: res.discount })
    } finally {
      setPromoChecking(false)
    }
  }

  function removePromo() {
    setApplied(null)
    setPromoInput('')
    setPromoError(null)
  }

  // Re-validate an applied promo whenever the cart contents change so the
  // preview discount always matches the current basket.
  useEffect(() => {
    if (!applied) return
    let cancelled = false
    validatePromoCode(applied.code, promoLines).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setApplied(null)
        setPromoError(res.error)
      } else {
        setApplied({ code: res.code, name: res.name, discount: res.discount })
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoLines])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('+380 ')
  const [email, setEmail] = useState('')

  // Auto-format Ukrainian phone: +380 XX XXX XX XX
  const handlePhoneChange = (raw: string) => {
    clearFieldError('phone')
    // Keep only digits and leading +
    let digits = raw.replace(/[^\d+]/g, '')
    if (!digits.startsWith('+')) digits = '+' + digits
    if (!digits.startsWith('+380')) {
      // If user deleted too much, keep +380 prefix
      if (digits.startsWith('+38')) digits = '+38' + digits.slice(3).replace(/\D/g, '')
      else if (digits.startsWith('+3')) digits = '+3'
      else if (digits.startsWith('+')) digits = '+'
    }
    const d = digits.replace(/^\+/, '')
    // Format as +380 XX XXX XX XX
    let formatted = '+'
    if (d.length > 0) formatted += d.slice(0, 3)
    if (d.length > 3) formatted += ' ' + d.slice(3, 5)
    if (d.length > 5) formatted += ' ' + d.slice(5, 8)
    if (d.length > 8) formatted += ' ' + d.slice(8, 10)
    if (d.length > 10) formatted += ' ' + d.slice(10, 12)
    // Don't allow more than 12 digits total (380 + 9 digits)
    setPhone(formatted.slice(0, 17))
  }
  const [note, setNote] = useState('')

  // Logged-in customers never type their email: it is taken from the account
  // and the field is hidden. The session loads asynchronously, so adjust the
  // field during render as soon as it becomes available (rather than in an
  // effect) — this is React's recommended pattern for syncing state to a
  // prop/value that changed since the last render.
  const [syncedSessionEmail, setSyncedSessionEmail] = useState<string | null>(null)
  if (session?.user?.email && session.user.email !== syncedSessionEmail) {
    setSyncedSessionEmail(session.user.email)
    setEmail(session.user.email)
  }

  const [delivery, setDelivery] = useState<string>(deliveryMethods[0]?.code ?? '')
  const [payment, setPayment] = useState<string>('')

  // Nova Poshta city/warehouse selection
  const [cityQuery, setCityQuery] = useState('')
  const [cities, setCities] = useState<NpCity[]>([])
  const [city, setCity] = useState<NpCity | null>(null)
  const [warehouses, setWarehouses] = useState<NpWarehouse[]>([])
  const [warehouse, setWarehouse] = useState<NpWarehouse | null>(null)
  const [loadingCities, setLoadingCities] = useState(false)
  const [loadingWh, setLoadingWh] = useState(false)
  // Nova Poshta point type + free-text branch/postomat field with suggestions.
  const [branchType, setBranchType] = useState<'branch' | 'postomat'>('branch')
  const [branchQuery, setBranchQuery] = useState('')
  const [branchFocused, setBranchFocused] = useState(false)

  // Ukrposhta manual fields
  const [upCity, setUpCity] = useState('')
  const [upIndex, setUpIndex] = useState('')

  // Saved-address autofill (for logged-in customers).
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [saveAddr, setSaveAddr] = useState(false)

  // Locally managed copy of saved addresses so we can remove one without a
  // full page reload.
  const [addresses, setAddresses] = useState<UserAddress[]>(savedAddresses)
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null)

  const removeAddress = async (id: number) => {
    setDeletingAddressId(id)
    try {
      const res = await deleteUserAddress(id)
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== id))
        if (selectedAddressId === id) setSelectedAddressId(null)
        toast.success(dict.account.addressDeleted)
      } else {
        toast.error(dict.account.genericError)
      }
    } finally {
      setDeletingAddressId(null)
    }
  }

  // Populate contact + delivery fields from a saved address.
  const applyAddress = (a: UserAddress) => {
    setSelectedAddressId(a.id)
    setFirstName(a.firstName || '')
    setLastName(a.lastName || '')
    if (a.phone) setPhone(a.phone)
    setDelivery(a.deliveryMethod || 'nova_poshta')
    if (a.deliveryMethod === 'ukrposhta') {
      setUpCity(a.city || '')
      setUpIndex(a.postIndex || '')
    } else {
      // Nova Poshta: prefill the free-text city + branch fields.
      if (a.city) {
        setCityQuery(a.city)
        setCity({ ref: a.cityRef || '', name: a.city, area: '', deliveryCityRef: a.cityRef || '' })
      }
      if (a.branchType === 'postomat' || a.branchType === 'branch') {
        setBranchType(a.branchType)
      }
      if (a.branch) setBranchQuery(a.branch)
    }
  }

  // Auto-apply the default saved address on first load (nothing selected yet).
  // Done as a render-time adjustment (not an effect) since it's a one-time
  // derivation from the initial `addresses` prop, not a subscription to an
  // external system.
  const [addressAutofilled, setAddressAutofilled] = useState(false)
  if (!addressAutofilled && addresses.length > 0) {
    setAddressAutofilled(true)
    const def = addresses.find((a) => a.isDefault) ?? addresses[0]
    if (def) applyAddress(def)
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<CheckoutResult & { success: true } | null>(null)
  // Snapshot of the ordered items + delivery captured before the cart is cleared,
  // so the confirmation screen can show what the customer actually ordered.
  const [orderSnapshot, setOrderSnapshot] = useState<{
    items: { id: number; name: string; price: number; quantity: number; image?: string | null; variantLabel?: string | null }[]
    deliveryLabel: string
    deliveryPlace?: string
  } | null>(null)

  const isNova = delivery === 'nova_poshta'
  const isUkr = delivery === 'ukrposhta'

  // A delivery is "branch based" when it ships to a Nova Poshta / Ukrposhta
  // office. Cash-on-delivery (наложенный платёж) is only allowed for those.
  const branchDelivery = delivery === 'nova_poshta' || delivery === 'ukrposhta'

  // Cash-on-delivery is only offered for branch deliveries.
  const availablePayments = useMemo(() => {
    return paymentMethods.filter((m) => (m.code === 'cod' ? branchDelivery : true))
  }, [paymentMethods, branchDelivery])

  // Pick a sane default payment, and clear an invalid one when rules change.
  // Adjusted during render (idempotent: only fires when the current value is
  // actually invalid) rather than in an effect.
  if (availablePayments.length > 0 && (!payment || !availablePayments.some((m) => m.code === payment))) {
    setPayment(availablePayments[0].code)
  }

  // Debounced city search for Nova Poshta.
  const cityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isNova) return
    if (city && cityQuery === city.name) return
    if (cityTimer.current) clearTimeout(cityTimer.current)
    if (cityQuery.trim().length < 2) {
      return
    }
    cityTimer.current = setTimeout(async () => {
      setLoadingCities(true)
      try {
        const res = await searchCities(cityQuery.trim())
        setCities(res)
      } finally {
        setLoadingCities(false)
      }
    }, 350)
    return () => {
      if (cityTimer.current) clearTimeout(cityTimer.current)
    }
  }, [cityQuery, isNova, city])

  const isPostomatName = (n: string) => /поштомат|почтомат/i.test(n)
  const branchSuggestions = useMemo(() => {
    const q = branchQuery.trim().toLowerCase()
    return warehouses
      .filter((w) => (branchType === 'postomat' ? isPostomatName(w.name) : !isPostomatName(w.name)))
      .filter((w) => (q.length === 0 ? true : w.name.toLowerCase().includes(q) || w.number.includes(branchQuery.trim())))
      .slice(0, 50)
  }, [warehouses, branchType, branchQuery])

  async function selectCity(c: NpCity) {
    setCity(c)
    setCityQuery(c.name)
    setCities([])
    setWarehouse(null)
    setBranchQuery('')
    setLoadingWh(true)
    try {
      // Nova Poshta getWarehouses needs the reference-book city ref
      // (DeliveryCity), not the settlement Ref returned by searchSettlements.
      const res = await searchWarehouses(c.deliveryCityRef || c.ref)
      setWarehouses(res)
    } finally {
      setLoadingWh(false)
    }
  }

  // ---- Abandoned cart tracking ----------------------------------------------
  // Once the visitor typed contact info (phone or email), we snapshot the cart
  // server-side (debounced) so the admin can follow up if checkout is never
  // completed. The token persists per browser so repeats update one row.
  const cartTokenRef = useRef<string>('')
  // Refs must not be read/written during render — initialize once on mount
  // instead. The debounced snapshot effect below only fires after the user
  // has typed contact info, so this one-render delay is harmless.
  useEffect(() => {
    if (cartTokenRef.current) return
    const stored = window.localStorage.getItem('v0.cartToken')
    if (stored) cartTokenRef.current = stored
    else {
      const token = crypto.randomUUID()
      window.localStorage.setItem('v0.cartToken', token)
      cartTokenRef.current = token
    }
  }, [])
  useEffect(() => {
    const digits = phone.replace(/\D/g, '')
    const hasContact = digits.length >= 12 || /\S+@\S+\.\S+/.test(email)
    if (!hasContact || items.length === 0 || !cartTokenRef.current) return
    const timer = setTimeout(() => {
      void saveAbandonedCart({
        token: cartTokenRef.current,
        name: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
        phone: digits.length >= 12 ? phone.trim() : undefined,
        email: /\S+@\S+\.\S+/.test(email) ? email.trim() : undefined,
        items: items.map((i) => ({
          productId: i.id,
          name: i.variantLabel ? `${i.name} (${i.variantLabel})` : i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
        })),
      }).catch(() => {})
    }, 2500)
    return () => clearTimeout(timer)
  }, [firstName, lastName, phone, email, items])

  function validate(): string | null {
    const errors: Record<string, string | null> = {}
    let firstError: string | null = null
    let firstErrorField: string | null = null

    if (!firstName.trim()) {
      errors.firstName = t.errFirstName
      firstError ??= t.errFirstName
      firstErrorField ??= 'firstName'
    }
    if (!lastName.trim()) {
      errors.lastName = t.errLastName
      firstError ??= t.errLastName
      firstErrorField ??= 'lastName'
    }
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 12) {
      errors.phone = t.errPhone
      firstError ??= t.errPhone
      firstErrorField ??= 'phone'
    }
    if (!delivery) {
      errors.delivery = t.errDelivery
      firstError ??= t.errDelivery
    }
    if (isNova) {
      if (!city) {
        errors.city = t.errCity
        firstError ??= t.errCity
        firstErrorField ??= 'np-city'
      }
      if (!branchQuery.trim()) {
        const msg = branchType === 'postomat' ? t.errPostomat : t.errBranch
        errors.branch = msg
        firstError ??= msg
      }
    }
    if (isUkr) {
      if (!upCity.trim()) {
        errors.ukrCity = t.errUkrCity
        firstError ??= t.errUkrCity
      }
      if (!upIndex.trim()) {
        errors.ukrIndex = t.errUkrIndex
        firstError ??= t.errUkrIndex
      }
    }
    if (!payment) {
      errors.payment = t.errPayment
      firstError ??= t.errPayment
    }
    setFieldErrors(errors)

    // Auto-scroll to the first error field for better UX.
    if (firstErrorField) {
      setTimeout(() => {
        const el = document.getElementById(firstErrorField!)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.focus()
      }, 100)
    }

    return firstError
  }

  async function handleSubmit() {
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await createStorefrontOrder({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        deliveryMethod: delivery,
        deliveryCity: isNova ? city?.name : isUkr ? upCity.trim() : undefined,
        deliveryCityRef: isNova ? city?.ref : undefined,
        deliveryBranch: isNova
          ? `${branchType === 'postomat' ? t.postomat : t.branch}: ${branchQuery.trim()}`
          : isUkr
            ? `${t.indexPrefix} ${upIndex.trim()}`
            : undefined,
        paymentMethod: payment,
        note: note.trim() || undefined,
        promoCode: applied?.code || undefined,
        items: items.map((i) => ({ productId: i.id, quantity: i.quantity, variantId: i.variantId ?? undefined })),
        cartToken: cartTokenRef.current || undefined,
      })
      if (!res.success) {
        setError(res.error)
        return
      }
      // Optionally persist this address to the customer's account for next time.
      if (isLoggedIn && saveAddr && (isNova || isUkr)) {
        try {
          await saveUserAddress({
            firstName: firstName.trim(),
            lastName: lastName.trim() || null,
            phone: phone.trim(),
            deliveryMethod: delivery,
            city: isNova ? city?.name ?? null : upCity.trim() || null,
            cityRef: isNova ? city?.ref ?? null : null,
            branch: isNova ? branchQuery.trim() || null : null,
            branchType: isNova ? branchType : null,
            postIndex: isUkr ? upIndex.trim() || null : null,
          })
        } catch {
          // Non-fatal: the order already succeeded.
        }
      }
      // Online gateway: don't finalize the UI or clear the cart yet. Send the
      // shopper to the payment page. The order stays "pending payment" until the
      // gateway confirms it, so pressing Back returns here with the cart intact.
      if (res.paymentMethod === 'online' && res.paymentUrl) {
        const url = res.paymentUrl
        if (/^https?:\/\//.test(url)) window.location.href = url
        else router.push(url)
        return
      }

      const deliveryLabel = methodLabel(
        delivery,
        deliveryMethods.find((m) => m.code === delivery)?.name ?? t.deliveryGeneric,
      )
      const deliveryPlace = isNova
        ? [city?.name, `${branchType === 'postomat' ? t.postomat : t.branch}: ${branchQuery.trim()}`]
            .filter(Boolean)
            .join(', ')
        : isUkr
          ? [upCity.trim(), upIndex.trim() ? `${t.indexPrefix} ${upIndex.trim()}` : ''].filter(Boolean).join(', ')
          : undefined
      setOrderSnapshot({
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
          variantLabel: i.variantLabel,
        })),
        deliveryLabel,
        deliveryPlace: deliveryPlace || undefined,
      })
      if (buyNow) clearBuyNow()
      else clear()
      setDone(res)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errGeneric)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <OrderSuccess result={done} snapshot={orderSnapshot} />
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-20 text-center">
        <ShoppingBag className="mb-4 size-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">{t.emptyTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.emptyDesc}</p>
        <Button className="mt-6" onClick={() => router.push('/catalog')}>
          {t.toCatalog}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Progress stepper — visual overview of checkout steps */}
      <div className="col-span-full">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 md:px-6">
          {[
            { step: 1, icon: User, label: t.contactInfo },
            { step: 2, icon: Truck, label: t.delivery },
            { step: 3, icon: CreditCard, label: t.payment },
          ].map((s, i, arr) => {
            // A step is "done" only when its own fields are filled AND every
            // previous step is done. Delivery/payment have preselected
            // defaults, so without the sequential gate step 3 showed a
            // checkmark before the visitor had entered anything at all.
            const step1Done =
              !!firstName.trim() && !!lastName.trim() && phone.replace(/\D/g, '').length >= 12
            const step2Done =
              step1Done &&
              !!delivery &&
              (isNova ? !!city && !!branchQuery.trim() : isUkr ? !!upCity.trim() && !!upIndex.trim() : true)
            const step3Done = step2Done && !!payment
            const done = s.step === 1 ? step1Done : s.step === 2 ? step2Done : step3Done
            return (
              <div key={s.step} className="flex flex-1 items-center">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    done
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {done ? <Check className="size-4" /> : s.step}
                  </div>
                  <span className="hidden text-sm font-medium text-foreground sm:block">{s.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={cn(
                    'mx-3 h-px flex-1 transition-colors',
                    done ? 'bg-primary' : 'bg-border',
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Step 1 — Contact */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <SectionHeader icon={User} step={1} title={t.contactInfo} stepLabel={t.step} />

          {addresses.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <MapPin className="size-4 text-primary" /> {t.savedAddresses}
              </p>
              <div className="flex flex-wrap gap-2">
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      'relative flex items-start gap-2 rounded-lg border py-2 pl-3 pr-9 text-left text-xs transition-colors',
                      selectedAddressId === a.id
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => applyAddress(a)}
                      className="text-left"
                    >
                      <span className="block font-medium text-foreground">
                        {a.label || a.city || t.savedAddresses}
                      </span>
                      <span className="block">
                        {[a.city, a.branch || a.postIndex].filter(Boolean).join(', ')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAddress(a.id)}
                      disabled={deletingAddressId === a.id}
                      aria-label="Удалить адрес"
                      className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {deletingAddressId === a.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={t.firstName} required error={fieldErrors.firstName}>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); clearFieldError('firstName') }}
                placeholder={t.firstNamePlaceholder}
                className={fieldErrors.firstName ? 'border-destructive' : ''}
              />
            </Field>
            <Field label={t.lastName} required error={fieldErrors.lastName}>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); clearFieldError('lastName') }}
                placeholder={t.lastNamePlaceholder}
                className={fieldErrors.lastName ? 'border-destructive' : ''}
              />
            </Field>
            <Field label={t.phone} required error={fieldErrors.phone}>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={t.phonePlaceholder}
                inputMode="tel"
                className={fieldErrors.phone ? 'border-destructive' : ''}
              />
            </Field>
            {!isLoggedIn && (
              <Field label={t.emailOptional}>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  type="email"
                />
              </Field>
            )}
          </div>
        </section>

        {/* Step 2 — Delivery */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <SectionHeader icon={Truck} step={2} title={t.delivery} stepLabel={t.step} />
          <div className="mt-4 flex flex-col gap-3">
            {deliveryMethods.map((m) => (
              <OptionCard
                key={m.code}
                active={delivery === m.code}
                onClick={() => {
                  setDelivery(m.code)
                  // COD only allows branch delivery (Nova Poshta / Ukrposhta), which is always the case here.
                }}
                title={methodLabel(m.code, m.name)}
                subtitle={
                  m.code === 'nova_poshta'
                    ? t.npSubtitle
                    : m.code === 'ukrposhta'
                      ? t.ukrSubtitle
                      : t.deliveryGeneric
                }
              />
            ))}

            {isNova && (
              <div className="mt-1 grid gap-3 rounded-xl bg-muted/40 p-4">
                <Field label={t.city} required error={fieldErrors.city}>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="np-city"
                      value={cityQuery}
                      onChange={(e) => {
                        setCityQuery(e.target.value)
                        setCity(null)
                        clearFieldError('city')
                        setWarehouse(null)
                      }}
                      placeholder={t.cityPlaceholder}
                      className="pl-9"
                    />
                    {loadingCities && (
                      <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                    {cityQuery.trim().length >= 2 && cities.length > 0 && (
                      <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-popover shadow-lg">
                        {cities.map((c) => (
                          <li key={c.ref}>
                            <button
                              type="button"
                              onClick={() => selectCity(c)}
                              className="flex w-full flex-col items-start px-4 py-2 text-left text-sm hover:bg-accent"
                            >
                              <span className="font-medium text-foreground">{c.name}</span>
                              <span className="text-xs text-muted-foreground">{c.area}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Field>

                {city && (
                  <>
                    <Field label={t.branchType} required>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { value: 'branch', label: t.branch },
                            { value: 'postomat', label: t.postomat },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setBranchType(opt.value)
                              setBranchQuery('')
                            }}
                            className={cn(
                              'h-10 rounded-md border text-sm font-medium transition-colors',
                              branchType === opt.value
                                ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                                : 'border-input text-foreground hover:border-muted-foreground/40',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field
                      label={branchType === 'postomat' ? t.postomat : t.branch}
                      required
                    >
                      <div className="relative">
                        <Input
                          value={branchQuery}
                          onChange={(e) => {
                            setBranchQuery(e.target.value)
                            setWarehouse(null)
                          }}
                          onFocus={() => setBranchFocused(true)}
                          onBlur={() => setTimeout(() => setBranchFocused(false), 150)}
                          placeholder={
                            branchType === 'postomat' ? t.postomatPlaceholder : t.branchPlaceholder
                          }
                        />
                        {loadingWh && (
                          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        )}
                        {branchFocused && branchSuggestions.length > 0 && (
                          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-popover shadow-lg">
                            {branchSuggestions.map((w) => (
                              <li key={w.ref}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setWarehouse(w)
                                    setBranchQuery(w.name)
                                    setBranchFocused(false)
                                  }}
                                  className="flex w-full items-start px-4 py-2 text-left text-sm hover:bg-accent"
                                >
                                  <span className="text-foreground">{w.name}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </Field>
                  </>
                )}
              </div>
            )}

            {isUkr && (
              <div className="mt-1 grid gap-3 rounded-xl bg-muted/40 p-4 sm:grid-cols-2">
                <Field label={t.city} required>
                  <Input value={upCity} onChange={(e) => setUpCity(e.target.value)} placeholder={t.ukrCityPlaceholder} />
                </Field>
                <Field label={t.ukrIndex} required>
                  <Input
                    value={upIndex}
                    onChange={(e) => setUpIndex(e.target.value)}
                    placeholder={t.ukrIndexPlaceholder}
                    inputMode="numeric"
                  />
                </Field>
              </div>
            )}

            {isLoggedIn && (isNova || isUkr) && (
              <label className="mt-1 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveAddr}
                  onChange={(e) => setSaveAddr(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                <span className="text-sm text-muted-foreground">{t.saveAddress}</span>
              </label>
            )}
          </div>
        </section>

        {/* Step 3 — Payment */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <SectionHeader icon={CreditCard} step={3} title={t.payment} stepLabel={t.step} />
          <div className="mt-4 flex flex-col gap-3">
            {availablePayments.map((m) => (
              <OptionCard
                key={m.code}
                active={payment === m.code}
                onClick={() => setPayment(m.code)}
                title={methodLabel(m.code, m.name)}
                icon={
                  m.code === 'cod' ? Banknote : m.code === 'requisites' ? FileText : CreditCard
                }
                subtitle={
                  m.code === 'cod'
                    ? t.codSubtitle
                    : m.code === 'online'
                      ? t.onlineSubtitle
                      : t.requisitesSubtitle
                }
              />
            ))}
          </div>

          <div className="mt-4">
            <Field label={t.comment}>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.commentPlaceholder}
                rows={3}
              />
            </Field>
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">{t.yourOrder}</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {items.map((i) => {
              const max = i.maxQuantity && i.maxQuantity > 0 ? i.maxQuantity : 1
              return (
                <li key={i.key} className="flex gap-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {i.image ? (
                      <Image src={i.image || '/placeholder.svg'} alt={i.name} fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="line-clamp-2 text-xs text-foreground">{i.name}</span>
                        {i.variantLabel ? (
                          <span className="block text-[11px] text-muted-foreground">{i.variantLabel}</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(i.key)}
                        aria-label={`${t.remove} ${i.name}`}
                        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {/* Editable quantity stepper (text-based, clamped to stock) */}
                      <div className="flex items-center rounded-lg border border-border">
                        <button
                          type="button"
                          onClick={() => updateQty(i.key, i.quantity - 1)}
                          disabled={i.quantity <= 1}
                          aria-label={t.decrease}
                          className="flex size-7 items-center justify-center rounded-l-lg text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={t.quantity}
                          value={i.quantity}
                          onChange={(e) => {
                            const n = Number.parseInt(e.target.value.replace(/\D/g, ''), 10)
                            if (!Number.isNaN(n)) updateQty(i.key, n)
                          }}
                          className="w-9 border-x border-border bg-transparent text-center text-sm font-medium text-foreground outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(i.key, i.quantity + 1)}
                          disabled={i.quantity >= max}
                          aria-label={t.increase}
                          className="flex size-7 items-center justify-center rounded-r-lg text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {formatPrice(i.price * i.quantity)}
                      </span>
                    </div>
                    {i.quantity >= max && (
                      <span className="text-[11px] text-muted-foreground">{t.max}: {max} {t.pcs}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Promo code */}
          <div className="mt-4 border-t border-border pt-4">
            {applied ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/10 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                  <Tag className="size-4 shrink-0 text-primary" />
                  <span className="truncate font-medium">{applied.code}</span>
                  <Check className="size-4 shrink-0 text-primary" />
                </span>
                <button
                  type="button"
                  onClick={removePromo}
                  className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                >
                  {t.promoRemove}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value)
                      setPromoError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                        e.preventDefault()
                        applyPromo()
                      }
                    }}
                    placeholder={t.promoPlaceholder}
                    className="h-10"
                    aria-label={t.promoLabel}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0"
                    onClick={applyPromo}
                    disabled={promoChecking || !promoInput.trim()}
                  >
                    {promoChecking ? <Loader2 className="size-4 animate-spin" /> : t.promoApply}
                  </Button>
                </div>
                {promoError && <p className="text-xs text-destructive">{promoError}</p>}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-between border-t border-border pt-4 text-sm text-muted-foreground">
            <span>{t.itemsCount} ({totalItems})</span>
            <span className="text-foreground">{formatPrice(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">{t.discount}</span>
              <span className="font-medium text-primary">−{formatPrice(discount)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between text-sm text-muted-foreground">
            <span>{t.delivery}</span>
            <span>{t.deliveryByCarrier}</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4">
            <span className="font-semibold text-foreground">{t.toPay}</span>
            <span className="text-lg font-bold text-foreground">{formatPrice(total)}</span>
          </div>

          {belowMinOrder && (
            <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              {t.minOrderPrefix} {formatPrice(minOrder!.amount)}. {t.minOrderAddMore}{' '}
              {formatPrice(minOrderShortfall)}.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            size="lg"
            className="mt-5 w-full gap-2"
            onClick={handleSubmit}
            disabled={submitting || belowMinOrder}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {t.submitting}
              </>
            ) : (
              <>
                <Lock className="size-4" /> {t.placeOrder}
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">{t.terms}</p>

          {/* Trust badges */}
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-5">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <Package className="size-5 text-primary" />
              <span className="text-[10px] leading-tight text-muted-foreground">{t.trustFreeShipping}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <RotateCcw className="size-5 text-primary" />
              <span className="text-[10px] leading-tight text-muted-foreground">{t.trustReturn}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-center">
              <ShieldCheck className="size-5 text-primary" />
              <span className="text-[10px] leading-tight text-muted-foreground">{t.trustSecurePayment}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  step,
  title,
  stepLabel,
}: {
  icon: typeof User
  step: number
  title: string
  stepLabel: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{stepLabel} {step}</p>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}

function OptionCard({
  active,
  onClick,
  title,
  subtitle,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle?: string
  icon?: typeof User
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-muted-foreground/40',
      )}
    >
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
          active ? 'border-primary' : 'border-muted-foreground/40',
        )}
      >
        {active && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
      {Icon && <Icon className="size-5 shrink-0 text-muted-foreground" />}
      <span className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </button>
  )
}

function OrderSuccess({
  result,
  snapshot,
}: {
  result: CheckoutResult & { success: true }
  snapshot: {
    items: { id: number; name: string; price: number; quantity: number; image?: string | null; variantLabel?: string | null }[]
    deliveryLabel: string
    deliveryPlace?: string
  } | null
}) {
  const router = useRouter()
  const { dict } = useI18n()
  const t = dict.checkout
  return (
    <div className="mx-auto max-w-xl">
      <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="size-8" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-foreground">{t.successTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t.orderNumberLabel} <span className="font-semibold text-foreground">№{result.orderNumber}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.successContact}{' '}
          <span className="font-semibold text-foreground">{formatPrice(result.total)}</span>
        </p>

        {snapshot && snapshot.items.length > 0 && (
          <div className="mt-6 w-full rounded-xl border border-border bg-muted/30 p-4 text-left">
            <p className="mb-3 text-sm font-semibold text-foreground">{t.orderComposition}</p>
            <ul className="flex flex-col gap-3">
              {snapshot.items.map((i) => (
                <li key={`${i.id}::${i.variantLabel ?? ''}`} className="flex items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {i.image ? (
                      <Image src={i.image || '/placeholder.svg'} alt={i.name} fill sizes="48px" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ShoppingBag className="size-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-foreground">{i.name}</p>
                    {i.variantLabel ? (
                      <p className="text-[11px] text-muted-foreground">{i.variantLabel}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {i.quantity} × {formatPrice(i.price)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatPrice(i.price * i.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">{snapshot.deliveryLabel}</span>
              {snapshot.deliveryPlace && (
                <span className="text-right text-foreground">{snapshot.deliveryPlace}</span>
              )}
            </div>
            {result.discount > 0 && (
              <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t.itemsCount}</span>
                  <span>{formatPrice(result.itemsTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Tag className="size-3.5 text-primary" />
                    {t.discount}
                    {result.promoCode ? ` (${result.promoCode})` : ''}
                  </span>
                  <span className="font-medium text-primary">−{formatPrice(result.discount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground">
                  <span>{t.toPay}</span>
                  <span>{formatPrice(result.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {result.paymentMethod === 'requisites' && result.requisites && (
          <div className="mt-6 w-full rounded-xl bg-muted/50 p-4 text-left">
            <p className="mb-2 text-sm font-semibold text-foreground">{t.requisitesTitle}</p>
            <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">
              {result.requisites}
            </pre>
          </div>
        )}

        {result.paymentMethod === 'online' && result.paymentUrl && (
          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={() => {
              const url = result.paymentUrl!
              // External gateway pages need a full navigation; internal demo page uses the router.
              if (/^https?:\/\//.test(url)) window.location.href = url
              else router.push(url)
            }}
          >
            {t.goToPayment}
          </Button>
        )}

        <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1 gap-1" onClick={() => router.push('/account/orders')}>
            {t.myOrders} <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" className="flex-1" onClick={() => router.push('/catalog')}>
            {t.continueShopping}
          </Button>
        </div>
      </div>
    </div>
  )
}
