'use client'

import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { sendAnalyticsEvent } from '@/lib/shop/track'
import { trackAddToCart } from '@/components/shop/google-ads'
import { useIsClient } from '@/lib/hooks/use-client-only'

export type CartItem = {
  // Unique line key: distinguishes the same product bought in different variants.
  key: string
  id: number
  // Human-readable URL segment for the product-detail link in cart/checkout
  // UI. Optional only for carts saved before this field existed — falls
  // back to the numeric id at render time.
  slug?: string
  name: string
  price: number
  image: string | null
  quantity: number
  maxQuantity: number
  variantId?: number | null
  // Human-readable variant, e.g. "42" or "Blue / 256 ГБ".
  variantLabel?: string | null
}

export function cartKey(id: number, variantId?: number | null): string {
  return `${id}::${variantId ?? ''}`
}

type CartContextValue = {
  items: CartItem[]
  count: number
  total: number
  isReady: boolean
  add: (item: Omit<CartItem, 'quantity' | 'key'>, quantity?: number) => void
  remove: (key: string) => void
  setQuantity: (key: string, quantity: number) => void
  clear: () => void
  // Slide-over cart drawer visibility. `add` opens it when openCartAfterAdd is on.
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
  // Express "Купить сейчас" purchase — kept completely separate from the cart.
  buyNowItem: CartItem | null
  startBuyNow: (item: Omit<CartItem, 'quantity' | 'key'>, quantity?: number) => void
  setBuyNowQuantity: (quantity: number) => void
  clearBuyNow: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'techno-cart-v1'
const BUYNOW_KEY = 'techno-buynow-v1'

function clampQty(quantity: number, max: number): number {
  const safeMax = max && max > 0 ? max : 1
  if (!Number.isFinite(quantity)) return 1
  return Math.max(1, Math.min(safeMax, Math.floor(quantity)))
}

const listeners = new Set<() => void>()

function emitCart() {
  for (const listener of listeners) listener()
}

function subscribeCart(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function parseCart(raw: string | null): CartItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as CartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((i) => (i.key ? i : { ...i, key: cartKey(i.id, i.variantId) }))
  } catch {
    return []
  }
}

let cachedRaw: string | null = null
let cachedItems: CartItem[] = []

function getCartSnapshot(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === cachedRaw) return cachedItems
    cachedRaw = raw
    cachedItems = parseCart(raw)
    return cachedItems
  } catch {
    return cachedItems
  }
}

function getServerCartSnapshot(): CartItem[] {
  return []
}

function persistCart(items: CartItem[]) {
  const raw = JSON.stringify(items)
  try {
    localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    // ignore quota / private-mode failures
  }
  cachedRaw = raw
  cachedItems = items
  emitCart()
}

function readBuyNow(): CartItem | null {
  try {
    const raw = sessionStorage.getItem(BUYNOW_KEY)
    return raw ? (JSON.parse(raw) as CartItem) : null
  } catch {
    return null
  }
}

export function CartProvider({
  children,
  gaId,
  openCartAfterAdd = true,
}: {
  children: ReactNode
  gaId?: string
  /** When false, adding an item does not auto-open the slide-over cart. */
  openCartAfterAdd?: boolean
}) {
  const items = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot)
  const isReady = useIsClient()
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [buyNowHydrated, setBuyNowHydrated] = useState(false)

  if (isReady && !buyNowHydrated) {
    setBuyNowHydrated(true)
    const stored = readBuyNow()
    if (stored) setBuyNowItem(stored)
  }

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0)
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
    return {
      items,
      count,
      total,
      isReady,
      add: (item, quantity = 1) => {
        const key = cartKey(item.id, item.variantId)
        const existing = items.find((i) => i.key === key)
        const next = existing
          ? items.map((i) =>
              i.key === key
                ? { ...i, quantity: clampQty(existing.quantity + quantity, existing.maxQuantity) }
                : i,
            )
          : [...items, { ...item, key, quantity: clampQty(quantity, item.maxQuantity) }]
        persistCart(next)
        if (openCartAfterAdd) setDrawerOpen(true)
        sendAnalyticsEvent({ type: 'add_to_cart', productId: item.id })
        trackAddToCart(gaId, { id: item.id, name: item.name, price: item.price, quantity })
      },
      remove: (key) => persistCart(items.filter((i) => i.key !== key)),
      setQuantity: (key, quantity) =>
        persistCart(items.map((i) => (i.key === key ? { ...i, quantity: clampQty(quantity, i.maxQuantity) } : i))),
      clear: () => persistCart([]),
      drawerOpen,
      setDrawerOpen,
      buyNowItem,
      startBuyNow: (item, quantity = 1) => {
        const key = cartKey(item.id, item.variantId)
        const next = { ...item, key, quantity: clampQty(quantity, item.maxQuantity) }
        setBuyNowItem(next)
        try {
          sessionStorage.setItem(BUYNOW_KEY, JSON.stringify(next))
        } catch {
          // ignore
        }
      },
      setBuyNowQuantity: (quantity) =>
        setBuyNowItem((prev) => {
          if (!prev) return prev
          const next = { ...prev, quantity: clampQty(quantity, prev.maxQuantity) }
          try {
            sessionStorage.setItem(BUYNOW_KEY, JSON.stringify(next))
          } catch {
            // ignore
          }
          return next
        }),
      clearBuyNow: () => {
        setBuyNowItem(null)
        try {
          sessionStorage.removeItem(BUYNOW_KEY)
        } catch {
          // ignore
        }
      },
    }
  }, [items, buyNowItem, isReady, drawerOpen, gaId, openCartAfterAdd])

  return (
    <CartContext.Provider value={value}>
      <span data-testid="cart-ready" data-ready={isReady ? '1' : '0'} hidden />
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export { formatPrice } from '@/lib/shop/format'
