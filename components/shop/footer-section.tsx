'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Collapsible footer column. On mobile it behaves as an accordion (tap the
 * header to expand/collapse with a smooth height animation). On desktop
 * (lg and up) the header is inert and the content is always visible, so the
 * footer renders as a normal multi-column layout.
 */
export function FooterSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-border/70 lg:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-4 text-left lg:pointer-events-none lg:py-0 lg:pb-4"
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <ChevronDown
          className={`size-5 shrink-0 text-muted-foreground transition-transform duration-300 lg:hidden ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
      <div
        className={`grid overflow-hidden transition-all duration-300 ease-out lg:grid-rows-[1fr] ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 lg:opacity-100'
        }`}
      >
        <div className="min-h-0 overflow-hidden lg:overflow-visible">
          <div className="pb-5 lg:pb-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
