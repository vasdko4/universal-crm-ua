'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, LayoutGrid, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HeaderCategory } from '@/components/shop/site-header'
import { useI18n } from '@/lib/i18n/client'
import { localizedPath } from '@/lib/i18n/config'

/**
 * Desktop category dropdown, zhuk.ua style: a "Каталог" trigger opens a
 * two-pane panel — a fixed-width vertical list of all top-level categories
 * on the left (with a highlighted "Акції" row on top), and, for the hovered
 * category, its subcategories laid out as a CSS multi-column flow (one
 * column per child, its grandchildren listed underneath) on the right.
 * Columns wrap onto extra rows automatically (no horizontal scrolling) when
 * a category has many children, same as zhuk.ua.
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

            {/* Multi-column flyout: each child of the hovered category gets
                its own block (header + its own children below). Uses a CSS
                multi-column flow so many children wrap onto extra rows
                within columns instead of needing horizontal scrolling. */}
            {activeChildren.length > 0 && (
              <div className="max-h-[70vh] w-[56rem] overflow-y-auto border-l border-border p-5">
                <Link
                  href={lp(`/category/${activeId}`)}
                  onClick={close}
                  className="mb-3 inline-block text-sm font-semibold text-primary hover:underline"
                >
                  {dict.nav.goToCategory} →
                </Link>
                <div className="columns-2 gap-x-8 lg:columns-4">
                  {activeChildren.map((c) => {
                    const grandChildren = childrenOf(c.id)
                    return (
                      <div key={c.id} className="mb-5 flex break-inside-avoid flex-col gap-1">
                        <Link
                          href={lp(`/category/${c.id}`)}
                          onClick={close}
                          className="mb-1 block text-sm font-semibold text-foreground transition-colors hover:text-primary"
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
                                  className="block text-sm text-muted-foreground transition-colors hover:text-primary"
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
