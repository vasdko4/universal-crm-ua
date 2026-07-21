'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Search, ImageIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/shop/format'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'

type SearchItem = {
  id: number
  name: string
  price: number
  oldPrice: number | null
  currency: string
  image: string | null
  inStock: boolean
}

type SearchResponse = { items: SearchItem[]; total: number }

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<SearchResponse>)

export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const { dict, locale } = useI18n()
  const lp = (p: string) => localizedPath(p, locale)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Debounce input so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const { data, isLoading } = useSWR<SearchResponse>(
    debounced.length >= 2 ? `/api/search?q=${encodeURIComponent(debounced)}` : null,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false, dedupingInterval: 5000 },
  )

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function close() {
    setOpen(false)
    onNavigate?.()
  }

  function goToCatalog() {
    const q = query.trim()
    router.push(q ? lp(`/catalog?search=${encodeURIComponent(q)}`) : lp('/catalog'))
    close()
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    goToCatalog()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Don't submit while a CJK IME composition is in progress.
    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault()
    if (e.key === 'Escape') setOpen(false)
  }

  const showDropdown = open && debounced.length >= 2
  const items = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div ref={rootRef} className="relative w-full">
      <form onSubmit={onSubmit} role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={dict.nav.searchPlaceholder}
          className="pl-9"
          aria-label={dict.common.search}
          aria-expanded={showDropdown}
          autoComplete="off"
        />
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg max-md:fixed max-md:inset-x-2 max-md:top-14 max-md:mt-0">
          {isLoading && items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{dict.common.loading}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{dict.nav.searchNoResults}</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((p) => (
                <li key={p.id}>
                  <Link
                    href={lp(`/product/${p.id}`)}
                    onClick={close}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent"
                  >
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {p.image ? (
                        <Image src={p.image || '/placeholder.svg'} alt="" fill sizes="44px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="size-4 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-popover-foreground">{p.name}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-primary">
                          {formatPrice(p.price, p.currency)}
                        </span>
                        {p.oldPrice ? (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(p.oldPrice, p.currency)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {total > items.length && (
            <button
              type="button"
              onClick={goToCatalog}
              className="block w-full border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              {dict.nav.searchViewAll} ({total})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
