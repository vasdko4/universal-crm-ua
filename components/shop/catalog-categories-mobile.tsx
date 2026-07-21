import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight, LayoutGrid } from 'lucide-react'
import type { HeaderCategory } from '@/components/shop/site-header'
import { localizedPath, type Locale } from '@/lib/i18n/config'

/**
 * Mobile-only catalog view: a browsable list of top-level categories, each with
 * its subcategories as chips. Renders instead of the product grid on small
 * screens so the catalog acts as a category directory (Prom-style).
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
  const lp = (p: string) => localizedPath(p, locale)
  const topCategories = categories.filter((c) => !c.parentId)
  const childrenOf = (parentId: number) => categories.filter((c) => c.parentId === parentId)

  if (topCategories.length === 0) return null

  return (
    <ul className={className}>
      {topCategories.map((parent) => {
        const children = childrenOf(parent.id)
        return (
          <li
            key={parent.id}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <Link
              href={lp(`/category/${parent.id}`)}
              className="flex items-center gap-3 px-4 py-3 active:bg-accent"
            >
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {parent.image ? (
                  <Image
                    src={parent.image || "/placeholder.svg"}
                    alt=""
                    width={40}
                    height={40}
                    className="size-full object-cover"
                  />
                ) : (
                  <LayoutGrid className="size-5 text-muted-foreground" aria-hidden="true" />
                )}
              </span>
              <span className="flex-1 text-sm font-semibold text-foreground text-balance">
                {parent.name}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>

            {children.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                {children.map((child) => (
                  <Link
                    key={child.id}
                    href={lp(`/category/${child.id}`)}
                    className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground active:bg-accent active:text-foreground"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
