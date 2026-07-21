'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from '@/lib/auth-client'
import {
  addFavorite,
  removeFavorite,
  mergeFavorites,
  getFavoriteIds,
} from '@/app/actions/favorites'

type FavoritesContextValue = {
  ids: number[]
  count: number
  isReady: boolean
  isFavorite: (productId: number) => boolean
  toggle: (productId: number) => void
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)
const STORAGE_KEY = 'techno-favorites-v1'

function readGuestIds(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)))
  } catch {
    return []
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession()
  const isAuthed = !!session?.user
  const [ids, setIds] = useState<number[]>([])
  const [isReady, setIsReady] = useState(false)
  // Tracks whether we've already merged the guest list for this login, so we
  // don't repeatedly push localStorage ids to the server on every render.
  const mergedRef = useRef(false)

  // Load the appropriate source once the auth state is known.
  useEffect(() => {
    if (isPending) return
    let cancelled = false

    async function load() {
      if (isAuthed) {
        // Merge any guest favorites collected before login, then read the
        // authoritative list from the account.
        const guestIds = readGuestIds()
        try {
          const serverIds =
            !mergedRef.current && guestIds.length > 0
              ? await mergeFavorites(guestIds)
              : await getFavoriteIds()
          mergedRef.current = true
          if (guestIds.length > 0) localStorage.removeItem(STORAGE_KEY)
          if (!cancelled) setIds(serverIds)
        } catch {
          if (!cancelled) setIds(guestIds)
        }
      } else {
        mergedRef.current = false
        if (!cancelled) setIds(readGuestIds())
      }
      if (!cancelled) setIsReady(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isAuthed, isPending])

  // Persist guest favorites locally (authed favorites live in the DB).
  useEffect(() => {
    if (!isReady || isAuthed) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // ignore
    }
  }, [ids, isReady, isAuthed])

  const toggle = useCallback(
    (productId: number) => {
      if (!Number.isInteger(productId) || productId <= 0) return
      setIds((prev) => {
        const has = prev.includes(productId)
        const next = has ? prev.filter((i) => i !== productId) : [productId, ...prev]
        // Optimistic UI; sync to server when logged in.
        if (isAuthed) {
          ;(has ? removeFavorite(productId) : addFavorite(productId)).catch(() => {
            // Roll back on failure.
            setIds((cur) =>
              has ? [productId, ...cur.filter((i) => i !== productId)] : cur.filter((i) => i !== productId),
            )
          })
        }
        return next
      })
    },
    [isAuthed],
  )

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids,
      count: ids.length,
      isReady,
      isFavorite: (productId: number) => ids.includes(productId),
      toggle,
    }),
    [ids, isReady, toggle],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
