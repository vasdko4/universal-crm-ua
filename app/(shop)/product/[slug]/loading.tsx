// Content-shaped skeleton for the product detail page so the layout is
// recognizable while data streams in, instead of a blank screen.
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        {/* Gallery */}
        <div className="aspect-square w-full animate-pulse rounded-2xl bg-muted" />

        {/* Info panel */}
        <div className="space-y-5 lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-6">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="flex gap-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" />
          <div className="h-11 w-full animate-pulse rounded-full bg-muted" />
          <div className="flex gap-3">
            <div className="h-11 flex-1 animate-pulse rounded-full bg-muted" />
            <div className="size-11 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-14 animate-pulse rounded-xl bg-muted" />
            <div className="h-14 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
