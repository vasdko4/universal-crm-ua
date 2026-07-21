import { cn } from '@/lib/utils'

// A branded, language-agnostic loading indicator shown as a route Suspense
// fallback while a page's server data is streaming in. Two counter-rotating
// rings around a softly pulsing brand dot read clearly as "please wait".
export function PageLoader({
  className,
  minHeight = 'min-h-[60vh]',
}: {
  className?: string
  minHeight?: string
}) {
  return (
    <div
      className={cn('flex w-full items-center justify-center', minHeight, className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex size-16 items-center justify-center">
        {/* Outer ring */}
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-border border-t-primary" />
        {/* Inner ring, spinning the other way for a lively feel */}
        <span className="absolute inset-2 animate-[spin_1.4s_linear_infinite_reverse] rounded-full border-[3px] border-border border-b-primary" />
        {/* Pulsing brand core */}
        <span className="size-2.5 animate-pulse rounded-full bg-primary" />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
