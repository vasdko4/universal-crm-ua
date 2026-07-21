'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, LayoutGrid, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HeaderCategory } from '@/components/shop/site-header'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'

/**
 * Desktop category dropdown in the Prom.ua style: a "Каталог" trigger opens a
 * single vertical list of all top-level categories (with a highlighted "Акції"
 * row on top). Hovering a category that has children reveals a flyout panel to
 * the right with its subcategories.
 */
export function CategoryMegaMenu({ categories }: { categories: HeaderCategory[] }) {
  const { dict, locale } = useI18n()
  const lp = (p: string) => localizedPath(p, locale)
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)

  const topCategories = categories.filter((c) => !c.parentId)
  const childrenOf = (parentId: number) => categories.filter((c) => c.parentId === parentId)
  const activeChildren = activeId ? childrenOf(activeId) : []

  if (topCategories.length === 0) return null

  const close = () => {
    setOpen(false)
    setActiveId(null)
  }

  return (
    <div className="relative" onMouseLeave={close}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <LayoutGrid className="size-4" />
        {dict.nav.categories}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 pt-2">
          <div className="flex rounded-xl border border-border bg-popover shadow-xl">
            {/* Single column of top-level categories */}
            <ul className="w-72 shrink-0 py-2">
              {/* Promotions highlight row */}
              <li className="mb-1 border-b border-border pb-1">
                <Link
                  href={lp('/catalog?discount=1')}
                  onClick={close}
                  onMouseEnter={() => setActiveId(null)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Percent className="size-3.5" />
                  </span>
                  {dict.nav.promotions}
                </Link>
              </li>

              {topCategories.map((c) => {
                const hasChildren = childrenOf(c.id).length > 0
                return (
                  <li key={c.id}>
                    <Link
                      href={lp(`/category/${c.id}`)}
                      onMouseEnter={() => setActiveId(c.id)}
                      onClick={close}
                      className={cn(
                        'flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors',
                        activeId === c.id
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-accent/60',
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      {hasChildren && <ChevronRight className="size-4 shrink-0 opacity-60" />}
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* Flyout with children (and grandchildren) of the hovered category */}
            {activeChildren.length > 0 && (
              <div className="max-h-[70vh] w-96 overflow-y-auto border-l border-border p-4">
                <Link
                  href={lp(`/category/${activeId}`)}
                  onClick={close}
                  className="mb-2 inline-block text-sm font-semibold text-primary hover:underline"
                >
                  {dict.nav.goToCategory}
                </Link>
                <ul className="flex flex-col gap-1">
                  {activeChildren.map((c) => {
                    const grandChildren = childrenOf(c.id)
                    return (
                      <li key={c.id}>
                        <Link
                          href={lp(`/category/${c.id}`)}
                          onClick={close}
                          className="block rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                        >
                          {c.name}
                        </Link>
                        {grandChildren.length > 0 && (
                          <ul className="flex flex-col">
                            {grandChildren.map((g) => (
                              <li key={g.id}>
                                <Link
                                  href={lp(`/category/${g.id}`)}
                                  onClick={close}
                                  className="block rounded-md py-1.5 pl-6 pr-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                  {g.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
