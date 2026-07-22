'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Store, LogOut, ChevronDown, Languages, Check } from 'lucide-react'
import { NAV_SECTIONS, hasPermission } from '@/lib/permissions'
import { authClient } from '@/lib/auth-client'
import { useAdminI18n } from '@/lib/i18n/admin/context'
import { setAdminLocale } from '@/app/actions/admin-locale'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type SidebarUser = {
  name: string
  email: string
  role: string
  permissions: string[]
}

export function AdminSidebar({
  user,
  storeName,
  logoUrl,
}: {
  user: SidebarUser
  storeName: string
  logoUrl: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const { locale, dict, setLocale } = useAdminI18n()
  const [switchingLocale, startLocaleSwitch] = useTransition()

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(user.permissions, item.permission)),
  })).filter((section) => section.items.length > 0)

  const handleSignOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  // Updates the DB immediately so the choice sticks to this admin account,
  // and flips the UI without waiting for a full page reload.
  const handleLocaleChange = (next: Locale) => {
    if (next === locale) return
    setLocale(next)
    startLocaleSwitch(async () => {
      await setAdminLocale(next)
      router.refresh()
    })
  }

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:w-60">
      <Link
        href="/"
        className="flex h-16 items-center gap-3 border-b border-sidebar-accent px-4 transition-colors hover:bg-sidebar-accent/50"
        title={dict.sidebar.goToSite}
      >
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sidebar-primary text-sidebar">
          {logoUrl ? (
            <Image src={logoUrl || '/placeholder.svg'} alt={storeName} width={32} height={32} className="size-full object-cover" />
          ) : (
            <Store className="size-5" />
          )}
        </div>
        <div className="hidden md:block">
          <p className="line-clamp-1 text-sm font-semibold leading-tight">{storeName}</p>
          <p className="text-xs text-sidebar-muted">{dict.sidebar.adminCenter}</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2" aria-label={dict.sidebar.mainNav}>
        {visibleSections.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted md:block">
              {dict.navSections[section.label] ?? section.label}
            </p>
            {section.items.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
              const label = dict.navItems[item.permission] ?? item.label
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary/15 text-sidebar-primary'
                      : 'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )}
                  title={label}
                >
                  <item.icon className="size-5 shrink-0" />
                  <span className="hidden md:inline">{label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-accent p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent disabled:opacity-60"
            disabled={switchingLocale}
            title={dict.common.language}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full text-sidebar-muted">
              <Languages className="size-5" />
            </div>
            <div className="hidden min-w-0 flex-1 md:block">
              <p className="line-clamp-1 text-sm font-medium">{dict.common.language}</p>
              <p className="line-clamp-1 text-xs text-sidebar-muted">{LOCALE_LABELS[locale]}</p>
            </div>
            <ChevronDown className="hidden size-4 text-sidebar-muted md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-48">
            {LOCALES.map((code) => (
              <DropdownMenuItem key={code} onClick={() => handleLocaleChange(code)}>
                <span className="flex-1">{LOCALE_LABELS[code]}</span>
                {code === locale ? <Check className="size-4" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar">
              {initials}
            </div>
            <div className="hidden min-w-0 flex-1 md:block">
              <p className="line-clamp-1 text-sm font-medium">{user.name}</p>
              <p className="line-clamp-1 text-xs text-sidebar-muted">
                {dict.roles[user.role] ?? user.role}
              </p>
            </div>
            <ChevronDown className="hidden size-4 text-sidebar-muted md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span>{user.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} disabled={signingOut}>
              <LogOut className="size-4" />
              {signingOut ? dict.sidebar.signingOut : dict.sidebar.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
