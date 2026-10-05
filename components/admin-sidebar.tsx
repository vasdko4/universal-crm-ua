'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Store, LogOut, ChevronDown, ShieldCheck } from 'lucide-react'
import { clearStaffTwoFactorCookie } from '@/app/actions/staff-2fa'
import { NAV_SECTIONS, hasPermission } from '@/lib/permissions'
import { authClient } from '@/lib/auth-client'
import { useAdminI18n } from '@/lib/i18n/admin/context'
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

const COLLAPSED_STORAGE_KEY = 'admin:sidebar:collapsed'

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (v === true) out[k] = true
      }
      return out
    }
  } catch {
    // ignore corrupted storage
  }
  return {}
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
  const { dict } = useAdminI18n()
  // Collapsed nav sections, persisted per browser. The section holding the
  // active page auto-expands so the current location is never hidden.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    typeof window === 'undefined' ? {} : loadCollapsed(),
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(collapsed))
    } catch {
      // storage unavailable — collapse state just won't persist
    }
  }, [collapsed])

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(user.permissions, item.permission)),
  })).filter((section) => section.items.length > 0)

  const isItemActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/')

  // The section holding the active page is never shown collapsed, so the
  // current location can't hide — no effect needed, derived during render.
  const activeLabel = visibleSections.find((s) => s.items.some((item) => isItemActive(item.href)))?.label
  const isSectionCollapsed = (label: string) => collapsed[label] === true && label !== activeLabel

  const toggleSection = (label: string) =>
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))

  const handleSignOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    await clearStaffTwoFactorCookie()
    router.push('/sign-in')
    router.refresh()
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
            // eslint-disable-next-line @next/next/no-img-element -- admin logo may be off-allowlist
            <img src={logoUrl} alt={storeName} width={32} height={32} className="size-full object-cover" />
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
        {visibleSections.map((section) => {
          const isCollapsed = isSectionCollapsed(section.label)
          const sectionLabel = dict.navSections[section.label] ?? section.label
          return (
            <div key={section.label} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => toggleSection(section.label)}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? dict.sidebar.expandSection : dict.sidebar.collapseSection}
                className="hidden w-full items-center justify-between gap-2 rounded-md px-3 pb-1 text-left text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted transition-colors hover:text-sidebar-foreground md:flex"
              >
                <span className="line-clamp-1">{sectionLabel}</span>
                <ChevronDown
                  className={cn('size-3.5 shrink-0 transition-transform', isCollapsed && '-rotate-90')}
                />
              </button>
              {!isCollapsed &&
                section.items.map((item) => {
                  const isActive = isItemActive(item.href)
                  const label = dict.navItems[item.labelKey ?? item.permission] ?? item.label
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
          )
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-accent p-2">
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
            <DropdownMenuItem asChild>
              <Link href="/admin/security">
                <ShieldCheck className="size-4" />
                {dict.twoFactor.menuItem}
              </Link>
            </DropdownMenuItem>
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
