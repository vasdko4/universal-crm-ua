function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className ?? ''}`} aria-hidden />
}

/** Loading skeleton for the storefront home page. */
export default function ShopHomeLoading() {
  return (
    <div className="space-y-8" aria-hidden>
      {/* Hero */}
      <Skeleton className="h-48 w-full rounded-2xl sm:h-64" />
      {/* Category chips */}
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      {/* Product grid */}
      <div>
        <Skeleton className="mb-4 h-7 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
