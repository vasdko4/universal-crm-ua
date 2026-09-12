'use client'

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
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

function persistCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore quota / private-mode failures
  }
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((i) => (i.key ? i : { ...i, key: cartKey(i.id, i.variantId) }))
  } catch {
    return []
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
  const [items, setItems] = useState<CartItem[]>([])
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null)
  // Same primitive as useIsClient — a mount effect that only setState(true)
  // is stripped by the React Compiler, which left data-ready="0" in Playwright.
  const isReady = useIsClient()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const itemsRef = useRef<CartItem[]>([])
  // If the shopper adds an item before we read localStorage, skip hydrating
  // an empty snapshot that would wipe the just-added line.
  const mutatedRef = useRef(false)
  const hydratedRef = useRef(false)

  function commit(next: CartItem[]) {
    mutatedRef.current = true
    itemsRef.current = next
    persistCart(next)
    setItems(next)
  }

  if (isReady && !hydratedRef.current) {
    hydratedRef.current = true
    if (!mutatedRef.current) {
      const stored = readCart()
      itemsRef.current = stored
      setItems(stored)
    }
    try {
      const rawBuy = sessionStorage.getItem(BUYNOW_KEY)
      if (rawBuy) setBuyNowItem(JSON.parse(rawBuy) as CartItem)
    } catch {
      // ignore
    }
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
        const prev = itemsRef.current
        const key = cartKey(item.id, item.variantId)
        const existing = prev.find((i) => i.key === key)
        const next = existing
          ? prev.map((i) =>
              i.key === key
                ? { ...i, quantity: clampQty(existing.quantity + quantity, existing.maxQuantity) }
                : i,
            )
          : [...prev, { ...item, key, quantity: clampQty(quantity, item.maxQuantity) }]
        commit(next)
        if (openCartAfterAdd) setDrawerOpen(true)
        sendAnalyticsEvent({ type: 'add_to_cart', productId: item.id })
        trackAddToCart(gaId, { id: item.id, name: item.name, price: item.price, quantity })
      },
      remove: (key) => commit(itemsRef.current.filter((i) => i.key !== key)),
      setQuantity: (key, quantity) =>
        commit(itemsRef.current.map((i) => (i.key === key ? { ...i, quantity: clampQty(quantity, i.maxQuantity) } : i))),
      clear: () => commit([]),
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
