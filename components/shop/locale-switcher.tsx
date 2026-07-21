'use client'

import { useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Globe } from 'lucide-react'
import { setLocale } from '@/app/actions/locale'
import { useI18n, persistLocaleClientSide } from '@/lib/i18n/client'
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, localizedPath, stripLocalePrefix, type Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

export function LocaleSwitcher({
  className,
  variant = 'dropdown',
}: {
  className?: string
  variant?: 'dropdown' | 'inline'
}) {
  const { locale } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function choose(next: Locale) {
    if (next === locale) return
    // Client-side persistence first: instant UI switch that survives even if
    // the server action response is lost behind a proxy.
    persistLocaleClientSide(next)
    // Navigate to the equivalent URL in the target locale (not just a cookie
    // flip): this is what actually makes /ru pages reachable via on-site
    // navigation and keeps the visible URL in sync with the rendered language
    // instead of the same URL silently varying by cookie.
    const query = searchParams.toString()
    const target = localizedPath(stripLocalePrefix(pathname), next) + (query ? `?${query}` : '')
    startTransition(async () => {
      try {
        await setLocale(next)
      } catch {
        // Client cookie already keeps the choice.
      }
      router.push(target)
      router.refresh()
    })
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            disabled={isPending}
            aria-pressed={locale === l}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              locale === l ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
            )}
          >
            <Globe className="size-4" aria-hidden />
            {LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5',
        isPending && 'opacity-60',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <Globe className="ml-1.5 mr-0.5 size-3.5 text-muted-foreground" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          disabled={isPending}
          aria-pressed={locale === l}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
            locale === l
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  )
}
