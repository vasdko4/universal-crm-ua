import type React from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAdminUser, requireAdmin } from '@/lib/session'
import { getStoreSettingsInternal } from '@/lib/store-settings'
import { AdminShell } from '@/components/admin-shell'
import { permissionForPath, hasPermission, NAV_SECTIONS } from '@/lib/permissions'
import { AdminLocaleProvider } from '@/lib/i18n/admin/context'
import { getAdminDictionary } from '@/lib/i18n/admin/dictionaries'
import { getAdminTheme } from '@/lib/admin/admin-themes'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const user = await getAdminUser()
  const locale = user?.locale ?? 'uk'
  return {
    title: locale === 'ru' ? 'Админ-центр' : 'Адмін-центр',
    robots: { index: false, follow: false },
  }
}

// First admin section the user is allowed to open (their "home" in the admin).
function firstAllowedPath(permissions: string[]): string | null {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (hasPermission(permissions, item.permission)) return item.href
    }
  }
  return null
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()

  // Enforce per-tab access. The admin entry point (/admin) silently forwards
  // to the first allowed section; deep links to forbidden pages show the
  // explicit "access denied" page.
  const pathname = (await headers()).get('x-pathname') ?? '/'
  if (!pathname.startsWith('/admin/access-denied')) {
    const required = permissionForPath(pathname)
    if (required && !hasPermission(user.permissions, required)) {
      if (pathname === '/admin' || pathname === '/admin/') {
        const fallback = firstAllowedPath(user.permissions)
        redirect(fallback ?? '/')
      }
      redirect('/admin/access-denied?key=' + required)
    }
  }

  const settings = await getStoreSettingsInternal().catch(() => null)
  const dict = getAdminDictionary(user.locale)
  // Admin panel color theme (Настройки → Дизайн). Validated against the registry.
  const adminTheme = getAdminTheme(settings?.adminTheme ?? 'teal').id

  return (
    <AdminLocaleProvider locale={user.locale} permissions={user.permissions}>
      <AdminShell
        user={{ name: user.name, email: user.email, role: user.role, permissions: user.permissions }}
        storeName={settings?.storeName ?? dict.sidebar.adminCenter}
        logoUrl={settings?.logoUrl ?? null}
        adminTheme={adminTheme}
      >
        {children}
      </AdminShell>
    </AdminLocaleProvider>
  )
}
