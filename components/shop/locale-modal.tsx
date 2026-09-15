'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Languages, Globe } from 'lucide-react'
import { setLocale, getLocaleForCurrentIp } from '@/app/actions/locale'
import { persistLocaleClientSide, useI18n } from '@/lib/i18n/client'
import { LOCALE_COOKIE, localizedPath, stripLocalePrefix, type Locale } from '@/lib/i18n/config'

function localeFromBrowser(): Locale | null {
  if (typeof navigator === 'undefined') return null
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const raw of langs) {
    const tag = raw.toLowerCase()
    if (tag.startsWith('uk') || tag.startsWith('ua')) return 'uk'
    if (tag.startsWith('ru')) return 'ru'
  }
  return null
}

export function LocaleModal({
  defaultLocale = 'uk',
  mode = 'browser',
}: {
  defaultLocale?: string
  mode?: 'modal' | 'browser'
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { dict } = useI18n()

  useEffect(() => {
    const alreadyChosen = document.cookie
      .split('; ')
      .some((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    if (alreadyChosen) return

    let cancelled = false

    async function resolve() {
      try {
        const fromIp = await getLocaleForCurrentIp()
        if (cancelled) return
        if (fromIp) {
          await choose(fromIp, { silent: true })
          return
        }
      } catch {
        // Fall through to browser / modal.
      }
      if (cancelled) return

      if (mode === 'browser') {
        const fromBrowser = localeFromBrowser() ?? (defaultLocale === 'ru' ? 'ru' : 'uk')
        await choose(fromBrowser, { silent: true })
        return
      }

      setOpen(true)
    }

    void resolve()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function choose(locale: Locale, opts?: { silent?: boolean }) {
    if (!opts?.silent) setOpen(false)
    persistLocaleClientSide(locale)
    try {
      await setLocale(locale)
    } catch {
      // Client cookie above already keeps the choice.
    }
    const query = searchParams.toString()
    const target = localizedPath(stripLocalePrefix(pathname), locale) + (query ? `?${query}` : '')
    router.push(target)
    router.refresh()
  }

  if (mode !== 'modal') return null

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-xl">{dict.header.chooseLanguage}</DialogTitle>
          <DialogDescription>{dict.header.chooseLanguageDesc}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 grid gap-3">
          <Button
            size="lg"
            variant={defaultLocale === 'uk' ? 'default' : 'outline'}
            className="h-14 justify-start gap-3 text-base"
            onClick={() => choose('uk')}
          >
            <Languages className="size-5" />
            Українська
          </Button>
          <Button
            size="lg"
            variant={defaultLocale === 'ru' ? 'default' : 'outline'}
            className="h-14 justify-start gap-3 text-base"
            onClick={() => choose('ru')}
          >
            <Globe className="size-5" />
            Русский
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
