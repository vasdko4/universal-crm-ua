'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Languages, Globe } from 'lucide-react'
import { setLocale, getLocaleForCurrentIp } from '@/app/actions/locale'
import { persistLocaleClientSide } from '@/lib/i18n/client'
import { LOCALE_COOKIE, localizedPath, stripLocalePrefix, type Locale } from '@/lib/i18n/config'

export function LocaleModal({ defaultLocale = 'uk' }: { defaultLocale?: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Open on first paint so SSR doesn't flash the modal before hydration.
  // Client-side cookie check guards against stale server HTML (e.g. a cached
  // page rendered before the cookie existed) re-asking after the choice.
  useEffect(() => {
    const alreadyChosen = document.cookie
      .split('; ')
      .some((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    if (alreadyChosen) return
    // No cookie on this browser/device yet — check whether this visitor's IP
    // already picked a language elsewhere (new browser, cleared cookies,
    // different device on the same network) before asking again.
    let cancelled = false
    getLocaleForCurrentIp()
      .then((locale) => {
        if (cancelled) return
        if (locale) choose(locale, { silent: true })
        else setOpen(true)
      })
      .catch(() => {
        if (!cancelled) setOpen(true)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function choose(locale: Locale, opts?: { silent?: boolean }) {
    if (!opts?.silent) setOpen(false)
    // Persist immediately on the client (cookie + live UI switch) so the
    // choice survives even if the server action response is lost.
    persistLocaleClientSide(locale)
    try {
      await setLocale(locale)
    } catch {
      // Client cookie above already keeps the choice.
    }
    // Land on the /ru equivalent of whatever page they're on when they pick
    // Russian, so the URL matches the rendered language from the start.
    const query = searchParams.toString()
    const target = localizedPath(stripLocalePrefix(pathname), locale) + (query ? `?${query}` : '')
    router.push(target)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-xl">Оберіть мову / Выберите язык</DialogTitle>
          <DialogDescription>
            Ви завжди зможете змінити її у шапці сайту
          </DialogDescription>
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
