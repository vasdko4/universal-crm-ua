'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ChevronDown, Check, Languages } from 'lucide-react'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { setAdminLocale } from '@/app/actions/admin-locale'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Thin top bar shown above every admin page. Currently only hosts the
// language switcher (kept separate from the sidebar per request), but is a
// natural place to add breadcrumbs/page titles later.
export function AdminHeader() {
  const router = useRouter()
  const { locale, dict, setLocale } = useAdminI18n()
  const [switchingLocale, startLocaleSwitch] = useTransition()

  const handleLocaleChange = (next: Locale) => {
    if (next === locale) return
    setLocale(next)
    startLocaleSwitch(async () => {
      await setAdminLocale(next)
      router.refresh()
    })
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-end border-b bg-background px-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
          disabled={switchingLocale}
          title={dict.common.language}
        >
          <Languages className="size-4" />
          <span>{LOCALE_LABELS[locale]}</span>
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {LOCALES.map((code) => (
            <DropdownMenuItem key={code} onClick={() => handleLocaleChange(code)}>
              <span className="flex-1">{LOCALE_LABELS[code]}</span>
              {code === locale ? <Check className="size-4" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
