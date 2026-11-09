'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = Omit<ImageProps, 'onLoadingComplete' | 'onError'> & {
  /** Show a spinning icon on top of the pulsing placeholder. Small
   *  thumbnails pass false so the grid doesn't turn into a spinner field. */
  showSpinner?: boolean
  /** Called when the current src finishes loading (or fails) — lets the
   *  gallery know it is safe to preload neighbouring photos. */
  onLoaded?: () => void
}

/**
 * next/image with a visible loading state. While the photo is still
 * downloading, the frame shows a pulsing placeholder (plus a spinner
 * unless showSpinner is false) instead of an empty white rectangle, then
 * fades it out once the image arrives. If the image errors, the
 * placeholder is hidden too so a broken image doesn't spin forever.
 *
 * The wrapper is absolutely positioned, so the parent must be `relative`
 * (all current call sites — gallery frame, thumbnails, product cards,
 * lightbox — already are). The image itself is rendered untouched, so
 * existing hover/scale transitions keep working.
 */
export function LoadingImage({ showSpinner = true, onLoaded, className, alt, ...props }: Props) {
  const [loaded, setLoaded] = useState(false)

  return (
    <>
      <Image
        {...props}
        alt={alt}
        onLoadingComplete={() => {
          setLoaded(true)
          onLoaded?.()
        }}
        onError={() => {
          setLoaded(true)
          onLoaded?.()
        }}
        className={className}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-muted/60 transition-opacity duration-200',
          loaded ? 'opacity-0' : 'animate-pulse opacity-100',
        )}
      >
        {showSpinner && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
      </span>
    </>
  )
}
