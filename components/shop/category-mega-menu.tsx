'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, LayoutGrid, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HeaderCategory } from '@/components/shop/site-header'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'

/**
 * Desktop category dropdown, zhuk.ua style: a purple "Каталог" trigger opens
 * a two-pane panel — a fixed-width vertical list of all top-level categories
 * on the left (with a highlighted "Акції" row on top), and, for the hovered
 * category, its subcategories laid out as several parallel columns (one per
 * child, its grandchildren listed underneath) on the right — rather than a
 * single nested list.
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
        className="flex items-center gap-2 rounded-lg bg-[var(--category-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--category-accent-foreground)] transition-colors hover:bg-[var(--category-accent-hover)]"
      >
        <LayoutGrid className="size-4" />
        {dict.nav.catalog}
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
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--category-accent)] text-[var(--category-accent-foreground)]">
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
                          ? 'bg-[var(--category-accent-soft)] font-medium text-[var(--category-accent)]'
                          : 'text-foreground hover:bg-accent/60',
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      {hasChildren && (
                        <ChevronRight
                          className={cn(
                            'size-4 shrink-0',
                            activeId === c.id ? 'text-[var(--category-accent)]' : 'opacity-60',
                          )}
                        />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>

            {/* Multi-column flyout: each child of the hovered category gets
                its own column (header + its own children below), matching
                zhuk.ua's layout instead of a single nested list. */}
            {activeChildren.length > 0 && (
              <div className="flex max-h-[70vh] w-[46rem] flex-col overflow-y-auto border-l border-border p-5">
                <Link
                  href={lp(`/category/${activeId}`)}
                  onClick={close}
                  className="mb-3 inline-block w-fit text-sm font-semibold text-[var(--category-accent)] hover:underline"
                >
                  {dict.nav.goToCategory} →
                </Link>
                <div className="grid auto-cols-[minmax(11rem,1fr)] grid-flow-col grid-rows-1 gap-x-8 overflow-x-auto">
                {activeChildren.map((c) => {
                  const grandChildren = childrenOf(c.id)
                  return (
                    <div key={c.id} className="flex flex-col gap-1 pb-4">
                      <Link
                        href={lp(`/category/${c.id}`)}
                        onClick={close}
                        className="mb-1 block text-sm font-semibold text-foreground transition-colors hover:text-[var(--category-accent)]"
                      >
                        {c.name}
                      </Link>
                      {grandChildren.length > 0 && (
                        <ul className="flex flex-col gap-1.5">
                          {grandChildren.map((g) => (
                            <li key={g.id}>
                              <Link
                                href={lp(`/category/${g.id}`)}
                                onClick={close}
                                className="block text-sm text-muted-foreground transition-colors hover:text-[var(--category-accent)]"
                              >
                                {g.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
