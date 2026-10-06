function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className ?? ''}`} aria-hidden />
}

/** Loading skeleton for the product detail page. */
export default function ProductLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-hidden>
      {/* Gallery */}
      <div className="space-y-3">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="size-16 shrink-0" />
          ))}
        </div>
      </div>
      {/* Info */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-10 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
