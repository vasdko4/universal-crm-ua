'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  COMPARE_STORAGE_KEY,
  readCompareIds,
  writeCompareIds,
  toggleCompare,
  removeFromCompare,
  type ToggleResult,
} from '@/lib/shop/compare'

type CompareContextValue = {
  ids: number[]
  count: number
  isReady: boolean
  isInCompare: (productId: number) => boolean
  /** Toggles a product; returns whether it ended up in the tray and whether the 4-item limit was hit. */
  toggle: (productId: number) => ToggleResult
  remove: (productId: number) => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

export function CompareProvider({ children }: { children: ReactNode }) {
  // Guest-only tray: the full compare state lives in localStorage. Render []
  // until mounted so SSR and the first client paint always agree.
  const [ids, setIds] = useState<number[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Genuine external-system sync (localStorage tray); the initial [] keeps
    // SSR and the first client render identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds(readCompareIds())
    setIsReady(true)
  }, [])

  // Cross-tab sync: toggling compare in one tab updates badges everywhere.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === COMPARE_STORAGE_KEY) setIds(readCompareIds())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Persist after every change. The pure helpers guarantee a clean, capped
  // array, so writeCompareIds only serializes.
  useEffect(() => {
    if (!isReady) return
    writeCompareIds(ids)
  }, [ids, isReady])

  const toggle = useCallback((productId: number): ToggleResult => {
    let result: ToggleResult = { ids, added: false, limitReached: false }
    setIds((prev) => {
      result = toggleCompare(prev, productId)
      return result.ids
    })
    return result
  }, [ids])

  const remove = useCallback((productId: number) => {
    setIds((prev) => removeFromCompare(prev, productId))
  }, [])

  const value = useMemo<CompareContextValue>(
    () => ({
      ids,
      count: ids.length,
      isReady,
      isInCompare: (productId: number) => ids.includes(productId),
      toggle,
      remove,
    }),
    [ids, isReady, toggle, remove],
  )

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare() {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within CompareProvider')
  return ctx
}
