function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className ?? ''}`} aria-hidden />
}

/** Loading skeleton for category pages. */
export default function CategoryLoading() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
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
  )
}
