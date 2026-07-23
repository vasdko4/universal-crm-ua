'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sendAnalyticsEvent } from '@/lib/shop/track'
import { trackAddToCart } from '@/components/shop/google-ads'

export type CartItem = {
  // Unique line key: distinguishes the same product bought in different variants.
  key: string
  id: number
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
  // Slide-over cart drawer visibility. `add` auto-opens it.
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

export function CartProvider({ children, gaId }: { children: ReactNode; gaId?: string }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[]
        // Backfill keys for carts saved before variant-aware line keys existed.
        // Genuinely must run post-mount: localStorage doesn't exist during
        // SSR, and eagerly reading it in a lazy useState initializer would
        // make the client's first render diverge from the server-rendered
        // HTML (a hydration mismatch) instead of deferring to this effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setItems(parsed.map((i) => (i.key ? i : { ...i, key: cartKey(i.id, i.variantId) })))
      }
    } catch {
      // ignore
    }
    try {
      // Buy-now lives in sessionStorage so it survives a refresh of /checkout
      // but never lingers across browser sessions like the cart does.
      const rawBuy = sessionStorage.getItem(BUYNOW_KEY)
      if (rawBuy) setBuyNowItem(JSON.parse(rawBuy) as CartItem)
    } catch {
      // ignore
    }
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore
    }
  }, [items, isReady])

  useEffect(() => {
    if (!isReady) return
    try {
      if (buyNowItem) sessionStorage.setItem(BUYNOW_KEY, JSON.stringify(buyNowItem))
      else sessionStorage.removeItem(BUYNOW_KEY)
    } catch {
      // ignore
    }
  }, [buyNowItem, isReady])

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0)
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
    return {
      items,
      count,
      total,
      isReady,
      add: (item, quantity = 1) => {
        setItems((prev) => {
          const key = cartKey(item.id, item.variantId)
          const existing = prev.find((i) => i.key === key)
          if (existing) {
            const next = clampQty(existing.quantity + quantity, existing.maxQuantity)
            return prev.map((i) => (i.key === key ? { ...i, quantity: next } : i))
          }
          return [...prev, { ...item, key, quantity: clampQty(quantity, item.maxQuantity) }]
        })
        // Reveal the slide-over cart so the shopper sees what was added.
        setDrawerOpen(true)
        sendAnalyticsEvent({ type: 'add_to_cart', productId: item.id })
        trackAddToCart(gaId, { id: item.id, name: item.name, price: item.price, quantity })
      },
      remove: (key) => setItems((prev) => prev.filter((i) => i.key !== key)),
      setQuantity: (key, quantity) =>
        setItems((prev) =>
          prev.map((i) => (i.key === key ? { ...i, quantity: clampQty(quantity, i.maxQuantity) } : i)),
        ),
      clear: () => setItems([]),
      drawerOpen,
      setDrawerOpen,
      buyNowItem,
      startBuyNow: (item, quantity = 1) => {
        const key = cartKey(item.id, item.variantId)
        setBuyNowItem({ ...item, key, quantity: clampQty(quantity, item.maxQuantity) })
      },
      setBuyNowQuantity: (quantity) =>
        setBuyNowItem((prev) => (prev ? { ...prev, quantity: clampQty(quantity, prev.maxQuantity) } : prev)),
      clearBuyNow: () => setBuyNowItem(null),
    }
  }, [items, buyNowItem, isReady, drawerOpen, gaId])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export { formatPrice } from '@/lib/shop/format'
