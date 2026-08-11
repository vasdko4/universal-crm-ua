'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronDown, CornerDownRight, LayoutGrid, Search, X } from 'lucide-react'
import type { HeaderCategory } from '@/components/shop/site-header'
import { localizedPath, type Locale } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/client'
import { pluralize } from '@/lib/i18n/plural'
import { cn } from '@/lib/utils'

/**
 * Mobile-only catalog view: a searchable, collapsible directory of top-level
 * categories with their subcategories. Renders instead of the product grid
 * on small screens so the catalog acts as a fast category finder.
 *
 * - A live text filter narrows the list by parent or child name, auto-opening
 *   any parent with a match so results are visible without extra taps.
 * - Parents are collapsed by default (accordion) to keep the initial list
 *   short and scannable; tapping a row toggles it, tapping a subcategory
 *   chip or the "view all" link navigates.
 */
export function CatalogCategoriesMobile({
  categories,
  className,
  locale = 'uk',
}: {
  categories: HeaderCategory[]
  className?: string
  locale?: Locale
}) {
  const { dict } = useI18n()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const lp = (p: string) => localizedPath(p, locale)
  const topCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories])
  const childrenOf = useMemo(() => {
    const map = new Map<number, HeaderCategory[]>()
    for (const c of categories) {
      if (c.parentId == null) continue
      const list = map.get(c.parentId) ?? []
      list.push(c)
      map.set(c.parentId, list)
    }
    return map
  }, [categories])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const isSearching = normalizedQuery.length > 0

  const results = useMemo(() => {
    if (!isSearching) {
      return topCategories.map((parent) => ({
        parent,
        children: childrenOf.get(parent.id) ?? [],
        matchedChildIds: null as Set<number> | null,
      }))
    }
    const matches = (name: string) => name.toLocaleLowerCase().includes(normalizedQuery)
    const out: { parent: HeaderCategory; children: HeaderCategory[]; matchedChildIds: Set<number> | null }[] = []
    for (const parent of topCategories) {
      const children = childrenOf.get(parent.id) ?? []
      const parentMatches = matches(parent.name)
      const matchedChildren = children.filter((c) => matches(c.name))
      if (parentMatches || matchedChildren.length > 0) {
        out.push({
          parent,
          children,
          matchedChildIds: parentMatches ? null : new Set(matchedChildren.map((c) => c.id)),
        })
      }
    }
    return out
  }, [isSearching, normalizedQuery, topCategories, childrenOf])

  if (topCategories.length === 0) return null

  const isOpen = (id: number) => isSearching || expanded.has(id)
  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={className}>
      {/* Live filter — matches parent or subcategory names */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.catalog.searchCategories}
          className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label={dict.catalog.searchCategories}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
            aria-label={dict.common.close}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {isSearching && results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {dict.catalog.searchCategoriesNoResults}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map(({ parent, children, matchedChildIds }) => {
            const open = isOpen(parent.id)
            return (
              <li key={parent.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => toggle(parent.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-accent"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {parent.image ? (
                      <Image
                        src={parent.image || '/placeholder.svg'}
                        alt=""
                        width={40}
                        height={40}
                        className="size-full object-cover"
                      />
                    ) : (
                      <LayoutGrid className="size-5 text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{parent.name}</span>
                    {children.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {children.length}{' '}
                        {pluralize(
                          children.length,
                          dict.catalog.subcategoriesCountOne,
                          dict.catalog.subcategoriesCountFew,
                          dict.catalog.subcategoriesCountMany,
                        )}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>

                {open && (
                  <div className="border-t border-border px-4 py-3">
                    {children.length > 0 && (
                      <ul className="flex flex-col gap-1" aria-label={dict.catalog.subcategoryBadge}>
                        {children.map((child) => (
                          <li key={child.id}>
                            <Link
                              href={lp(`/category/${child.id}`)}
                              className={cn(
                                'flex items-center gap-2 rounded-lg px-2 py-2 text-sm active:bg-accent',
                                matchedChildIds?.has(child.id)
                                  ? 'bg-primary/10 font-medium text-primary'
                                  : 'text-foreground',
                              )}
                            >
                              <CornerDownRight
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span className="truncate">{child.name}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      href={lp(`/category/${parent.id}`)}
                      className={cn(
                        'mt-3 inline-flex items-center text-xs font-semibold text-primary active:underline',
                        children.length === 0 && 'mt-0',
                      )}
                    >
                      {dict.catalog.viewAllInCategory} →
                    </Link>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
